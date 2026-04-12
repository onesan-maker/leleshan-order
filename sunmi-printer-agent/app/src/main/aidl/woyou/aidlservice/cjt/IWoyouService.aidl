// IWoyouService.aidl — SUNMI 官方印表機服務介面（照抄，不可修改）
package woyou.aidlservice.cjt;

import woyou.aidlservice.cjt.ICallback;

interface IWoyouService {
    void printerInit(in ICallback callback);
    void printText(String text, in ICallback callback);
    void printTextWithFont(String text, String typeface, float fontsize, in ICallback callback);
    void setAlignment(int alignment, in ICallback callback);
    void setFontSize(float fontsize, in ICallback callback);
    void setBold(int enable, in ICallback callback);
    void lineWrap(int n, in ICallback callback);
    void cutPaper(in ICallback callback);
    void printAndFeedPaper(int distance, in ICallback callback);
    void printColumnsText(
        in String[] colsTextArr,
        in int[]    colsWidthArr,
        in int[]    colsAlign,
        in ICallback callback
    );
    String getPrinterSerialNo();
    String getServiceVersion();
    void enterPrinterBuffer(boolean clean);
    void exitPrinterBufferWithCallback(boolean commit, in ICallback callback);
}
