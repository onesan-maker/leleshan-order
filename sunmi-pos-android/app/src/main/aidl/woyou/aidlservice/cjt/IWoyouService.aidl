// IWoyouService.aidl
package woyou.aidlservice.cjt;

import woyou.aidlservice.cjt.ICallback;

interface IWoyouService {
    // 初始化印表機
    void printerInit(in ICallback callback);

    // 列印純文字
    void printText(String text, in ICallback callback);

    // 列印文字（指定字體大小）
    void printTextWithFont(String text, String typeface, float fontsize, in ICallback callback);

    // 設定對齊方式：0=左 1=置中 2=右
    void setAlignment(int alignment, in ICallback callback);

    // 設定字體大小
    void setFontSize(float fontsize, in ICallback callback);

    // 換行 n 行
    void lineWrap(int n, in ICallback callback);

    // 走紙並切紙
    void cutPaper(in ICallback callback);

    // 走紙 distance mm
    void printAndFeedPaper(int distance, in ICallback callback);

    // 列印多欄文字
    void printColumnsText(
        in String[] colsTextArr,
        in int[]    colsWidthArr,
        in int[]    colsAlign,
        in ICallback callback
    );

    // 取得印表機序號
    String getPrinterSerialNo();

    // 取得服務版本
    String getServiceVersion();

    // 進入緩衝模式（clean=true 清除緩衝）
    void enterPrinterBuffer(boolean clean);

    // 離開緩衝模式（commit=true 提交列印）
    void exitPrinterBufferWithCallback(boolean commit, in ICallback callback);
}
