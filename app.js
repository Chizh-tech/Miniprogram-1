App({
  onLaunch() {
    const diaries = wx.getStorageSync('diaries');
    if (!diaries) {
      wx.setStorageSync('diaries', {});
    }
  },
  globalData: {
    userInfo: null
  }
});
