const config = require('./config');

App({
  onLaunch() {
    const diaries = wx.getStorageSync('diaries');
    if (!diaries) {
      wx.setStorageSync('diaries', {});
    }

    if (wx.cloud && config.CLOUD_ENV_ID) {
      wx.cloud.init({
        env: config.CLOUD_ENV_ID,
        traceUser: true
      });
      this.globalData.useCloudStorage = true;
    }
  },
  globalData: {
    userInfo: null,
    useCloudStorage: false
  }
});
