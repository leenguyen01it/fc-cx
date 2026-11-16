/**
 * App ngân hàng hỗ trợ mở bằng deeplink của VietQR (https://www.vietqr.io/danh-sach-api/deeplink-app-ngan-hang).
 * Lấy từ api.vietqr.io/v2/{android,ios}-app-deeplinks, sắp theo lượt cài. autofill = app tự điền STK, số tiền, nội dung.
 */
export interface BankApp {
  id: string;
  name: string;
  android: boolean;
  ios: boolean;
  autofill: boolean;
}

export const BANK_APPS: BankApp[] = [
  { id: "mb", name: "MB Bank", android: true, ios: true, autofill: true },
  { id: "vcb", name: "VCB Digibank", android: true, ios: true, autofill: false },
  { id: "vba", name: "Agribank Plus", android: true, ios: true, autofill: false },
  { id: "tcb", name: "Techcombank Mobile", android: true, ios: true, autofill: false },
  { id: "icb", name: "VietinBank iPay", android: true, ios: true, autofill: true },
  { id: "bidv", name: "BIDV SmartBanking", android: true, ios: true, autofill: true },
  { id: "vpb", name: "VPBank NEO", android: true, ios: true, autofill: false },
  { id: "cake", name: "CAKE - Ngân hàng số", android: true, ios: true, autofill: false },
  { id: "tpb", name: "TPBank Mobile", android: true, ios: true, autofill: false },
  { id: "ocb", name: "OCB OMNI", android: true, ios: true, autofill: true },
  { id: "lpb", name: "LPBank", android: true, ios: true, autofill: false },
  { id: "timo", name: "Timo - Ngân hàng số by BVBank", android: true, ios: true, autofill: false },
  { id: "acb", name: "ACB ONE", android: true, ios: true, autofill: true },
  { id: "vib-2", name: "MyVIB", android: true, ios: true, autofill: false },
  { id: "hdb", name: "HDBank", android: true, ios: true, autofill: false },
  { id: "shb", name: "SHB SAHA", android: true, ios: true, autofill: false },
  { id: "shbvn", name: "Shinhan SOL Việt Nam", android: true, ios: true, autofill: false },
  { id: "scb", name: "SCB Mobile Banking", android: true, ios: true, autofill: false },
  { id: "seab", name: "SeAMobile", android: true, ios: true, autofill: false },
  { id: "abb", name: "ABBank", android: true, ios: true, autofill: false },
  { id: "nab", name: "Nam A Bank Open Banking", android: true, ios: false, autofill: false },
  { id: "eib", name: "Eximbank EDigi", android: true, ios: true, autofill: false },
  { id: "pvcb", name: "PVConnect", android: true, ios: true, autofill: false },
  { id: "coopbank", name: "Co-opBank Mobile Banking", android: true, ios: true, autofill: false },
  { id: "wvn", name: "Woori WON Vietnam", android: true, ios: true, autofill: false },
  { id: "acb-biz", name: "ACB ONE Biz", android: true, ios: true, autofill: false },
  { id: "vab", name: "Vietbank Digital Plus", android: true, ios: true, autofill: false },
  { id: "sgicb", name: "SAIGONBANK Smart Banking", android: true, ios: true, autofill: false },
  { id: "cimb", name: "Octo by CIMB Vietnam", android: true, ios: true, autofill: false },
  { id: "bvb", name: "BAOVIET Smart", android: true, ios: true, autofill: false },
  { id: "pbvn", name: "PB engage VN", android: true, ios: true, autofill: false },
  { id: "mbv", name: "MBV Bank", android: true, ios: true, autofill: false },
  { id: "ncb", name: "NCB iziMobile", android: true, ios: true, autofill: false },
  { id: "klb", name: "KienlongBank Plus", android: true, ios: true, autofill: false },
];
