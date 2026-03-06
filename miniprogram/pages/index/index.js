const db = wx.cloud.database(); // 初始化云数据库

Page({
  data: {
    content: '',
    mediaPath: ''
  },

  // 监听输入
  onInput(e) {
    this.setData({
      content: e.detail.value
    });
  },

  // 选择图片或视频
  uploadMedia() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image', 'video'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          mediaPath: res.tempFiles[0].tempFilePath
        });
      }
    });
  },

  // 保存到云端数据库
  saveDiary() {
    const { content, mediaPath } = this.data;

    if (!content && !mediaPath) {
      return wx.showToast({ title: '内容不能为空', icon: 'none' });
    }

    wx.showLoading({ title: '正在保存...' });

    // 存入云开发数据库 diaries 集合
    db.collection('diaries').add({
      data: {
        content: content,
        mediaPath: mediaPath,
        createTime: db.serverDate() // 记录存入时间
      },
      success: (res) => {
        wx.hideLoading();
        wx.showToast({ title: '已同步至云端', icon: 'success' });
        // 清空当前页面，方便下次输入
        this.setData({
          content: '',
          mediaPath: ''
        });
        console.log('保存成功，ID为：', res._id);
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '保存失败', icon: 'none' });
        console.error('数据库写入错误：', err);
      }
    });
  }
});