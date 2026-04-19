declare module 'react-native-upi-payment' {
  interface UpiConfig {
    vpa: string;
    payeeName: string;
    amount: string;
    transactionNote: string;
    transactionRef: string;
    merchantCode?: string;
    currency?: string;
  }

  function initializePayment(
    config: UpiConfig,
    successCallback: (success: any) => void,
    failureCallback: (error: any) => void
  ): void;

  export default {
    initializePayment,
  };
}
