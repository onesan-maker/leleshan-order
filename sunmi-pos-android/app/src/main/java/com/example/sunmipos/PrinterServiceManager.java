package com.example.sunmipos;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.RemoteException;
import android.util.Log;

import com.example.sunmipos.model.CartItem;

import java.util.List;

import woyou.aidlservice.cjt.ICallback;
import woyou.aidlservice.cjt.IWoyouService;

/**
 * 負責綁定 SUNMI 內建印表機 Service 並執行所有列印操作。
 * 使用前呼叫 bindService()，Activity onDestroy 時呼叫 unbindService()。
 */
public class PrinterServiceManager {

    private static final String TAG = "PrinterServiceManager";

    // SUNMI 內建印表機 AIDL service 資訊
    private static final String PACKAGE_NAME = "woyou.aidlservice.cjt";
    private static final String CLASS_NAME   = "woyou.aidlservice.cjt.WoyouService";

    private final Context context;
    private IWoyouService woyouService;
    private boolean isBound = false;

    // 綁定成功後的 callback
    public interface OnBindListener {
        void onBound();
        void onBindFailed();
    }

    private OnBindListener bindListener;

    // -------------------------------------------------------------------------
    // ICallback stub（列印結果回呼，不阻塞 UI thread）
    // -------------------------------------------------------------------------
    private final ICallback printCallback = new ICallback.Stub() {
        @Override
        public void onRunResult(boolean isSuccess) {
            Log.d(TAG, "onRunResult: " + isSuccess);
        }

        @Override
        public void onReturnString(String result) {
            Log.d(TAG, "onReturnString: " + result);
        }

        @Override
        public void onRaiseException(int code, String msg) {
            Log.e(TAG, "onRaiseException code=" + code + " msg=" + msg);
        }

        @Override
        public void onPrintResult(int code, String msg) {
            Log.d(TAG, "onPrintResult code=" + code + " msg=" + msg);
        }
    };

    // -------------------------------------------------------------------------
    // ServiceConnection
    // -------------------------------------------------------------------------
    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            woyouService = IWoyouService.Stub.asInterface(service);
            isBound = true;
            Log.i(TAG, "Printer service connected");
            if (bindListener != null) bindListener.onBound();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            woyouService = null;
            isBound = false;
            Log.w(TAG, "Printer service disconnected");
        }
    };

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    public PrinterServiceManager(Context context) {
        this.context = context.getApplicationContext();
    }

    // -------------------------------------------------------------------------
    // Bind / Unbind
    // -------------------------------------------------------------------------
    public void bindService(OnBindListener listener) {
        this.bindListener = listener;
        Intent intent = new Intent();
        intent.setPackage(PACKAGE_NAME);
        intent.setAction(PACKAGE_NAME);
        // 也可以用 ComponentName 精確指定
        // intent.setComponent(new ComponentName(PACKAGE_NAME, CLASS_NAME));
        boolean result = context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
        if (!result) {
            Log.e(TAG, "bindService failed – SUNMI printer service not found");
            if (listener != null) listener.onBindFailed();
        }
    }

    public void unbindService() {
        if (isBound) {
            context.unbindService(serviceConnection);
            isBound = false;
        }
    }

    public boolean isReady() {
        return isBound && woyouService != null;
    }

    // -------------------------------------------------------------------------
    // 列印小票
    // -------------------------------------------------------------------------
    /**
     * 列印訂單小票。
     *
     * 格式：
     * ==========
     * 樂樂山
     * ----------
     * 品項 x 數量   小計
     * ----------
     * 總計: xxx
     * ==========
     *
     * @param items     購物車內容
     * @param total     總金額
     */
    public void printReceipt(List<CartItem> items, int total) {
        if (!isReady()) {
            Log.e(TAG, "printReceipt called but service not ready");
            return;
        }

        try {
            // 使用緩衝模式，全部指令準備好再一次送出
            woyouService.enterPrinterBuffer(true);

            // --- 初始化 ---
            woyouService.printerInit(printCallback);

            // --- 標題 ---
            woyouService.setAlignment(1, printCallback);         // 置中
            woyouService.setFontSize(28f, printCallback);
            woyouService.printText("==========\n", printCallback);
            woyouService.printText("樂樂山\n", printCallback);
            woyouService.setFontSize(24f, printCallback);
            woyouService.printText("----------\n", printCallback);

            // --- 品項列表：左對齊，兩欄（品名x數量 / 小計） ---
            woyouService.setAlignment(0, printCallback);
            woyouService.setFontSize(22f, printCallback);

            for (CartItem item : items) {
                String left  = item.getProduct().getName() + " x" + item.getQuantity();
                String right = "$" + item.getSubtotal();
                // 用兩欄列印：左對齊品名、右對齊金額
                woyouService.printColumnsText(
                    new String[]{ left, right },
                    new int[]   { 7, 3 },        // 欄寬比例（共 10）
                    new int[]   { 0, 2 },        // 0=左 2=右
                    printCallback
                );
            }

            // --- 分隔線 + 總計 ---
            woyouService.setAlignment(0, printCallback);
            woyouService.printText("----------\n", printCallback);
            woyouService.setFontSize(26f, printCallback);
            woyouService.printText("總計: $" + total + "\n", printCallback);
            woyouService.setFontSize(24f, printCallback);
            woyouService.printText("==========\n", printCallback);

            // --- 走紙 + 切紙 ---
            woyouService.lineWrap(3, printCallback);
            woyouService.cutPaper(printCallback);

            // 提交緩衝
            woyouService.exitPrinterBufferWithCallback(true, printCallback);

            Log.i(TAG, "Receipt sent to printer, total=" + total);

        } catch (RemoteException e) {
            Log.e(TAG, "Remote exception during printing", e);
        }
    }
}
