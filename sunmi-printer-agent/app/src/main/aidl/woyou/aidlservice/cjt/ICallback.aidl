// ICallback.aidl  — SUNMI 官方回呼介面（照抄，不可修改）
package woyou.aidlservice.cjt;

interface ICallback {
    void onRunResult(boolean isSuccess);
    void onReturnString(String result);
    void onRaiseException(int code, String msg);
    void onPrintResult(int code, String msg);
}
