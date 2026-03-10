const util = require('../../utils/util');
const storage = require('../../utils/storage');

Page({
  data: {
    diary: null,
    date: '',
    dateDisplay: '',
    currentVideoIndex: -1,
    imagePreviewUrls: [],
    videoPreviewUrls: [],
    isSharedView: false
  },

  async onLoad(options) {
    if (options && options.shareData) {
      const sharedDiary = this.parseShareData(options.shareData);
      if (sharedDiary) {
        wx.setNavigationBarTitle({ title: sharedDiary.title || '分享的日记' });
        this.setData({
          diary: sharedDiary,
          date: sharedDiary.date || '',
          dateDisplay: sharedDiary.dateDisplay || (sharedDiary.date || ''),
          imagePreviewUrls: sharedDiary.images || [],
          videoPreviewUrls: sharedDiary.videos || [],
          isSharedView: true
        });
        return;
      }
    }

    const date = options.date;
    this.setData({ date, isSharedView: false });
    await this.loadDiary();
  },

  async onShow() {
    if (this.data.isSharedView) return;
    await this.loadDiary();
  },

  parseShareData(rawData) {
    try {
      const decoded = decodeURIComponent(rawData);
      const parsed = JSON.parse(decoded);
      if (!parsed || !parsed.date) return null;

      return {
        date: parsed.date,
        title: parsed.title || '',
        content: parsed.content || '',
        location: parsed.location || null,
        weather: parsed.weather || null,
        createdAt: parsed.createdAt || '',
        updatedAt: parsed.updatedAt || '',
        dateDisplay: parsed.dateDisplay || parsed.date,
        images: [],
        videos: []
      };
    } catch (err) {
      return null;
    }
  },

  buildShareData() {
    const { diary, dateDisplay } = this.data;
    if (!diary) return '';

    const payload = {
      date: diary.date,
      dateDisplay: dateDisplay || diary.date,
      title: diary.title || '',
      // 控制分享路径长度，避免 query 过长导致分享失败。
      content: (diary.content || '').slice(0, 180),
      location: diary.location || null,
      weather: diary.weather || null,
      createdAt: diary.createdAt || '',
      updatedAt: diary.updatedAt || ''
    };

    return encodeURIComponent(JSON.stringify(payload));
  },

  getShareConfig() {
    const { diary } = this.data;
    const title = diary && diary.title
      ? `日记分享：${diary.title}`
      : `日记分享：${this.data.dateDisplay || '我的日记'}`;
    const shareData = this.buildShareData();

    return {
      title,
      path: `/pages/detail/detail?shareData=${shareData}`
    };
  },

  /**
   * 加载日记数据
   */
  async loadDiary() {
    const { date } = this.data;
    const diary = await storage.getDiaryByDate(date);
    if (!diary) {
      wx.showToast({ title: '日记不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }

    const dateObj = util.parseDate(date);
    const dateDisplay = `${date}  ${util.getWeekdayName(dateObj.getDay())}`;

    wx.setNavigationBarTitle({ title: diary.title || '日记详情' });

    const imagePreviewUrls = await this.resolveFileUrls(diary.images || []);
    const videoPreviewUrls = await this.resolveFileUrls(diary.videos || []);

    this.setData({ diary, dateDisplay, imagePreviewUrls, videoPreviewUrls });
  },

  async resolveFileUrls(fileRefs) {
    if (!Array.isArray(fileRefs) || fileRefs.length === 0) {
      return [];
    }

    const cloudRefs = fileRefs.filter(ref => typeof ref === 'string' && ref.startsWith('cloud://'));
    if (cloudRefs.length === 0 || !wx.cloud) {
      return [...fileRefs];
    }

    try {
      const res = await wx.cloud.getTempFileURL({ fileList: cloudRefs });
      const urlMap = {};
      (res.fileList || []).forEach(item => {
        if (item && item.fileID) {
          urlMap[item.fileID] = item.tempFileURL || item.fileID;
        }
      });

      return fileRefs.map(ref => urlMap[ref] || ref);
    } catch (err) {
      return [...fileRefs];
    }
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const { index } = e.currentTarget.dataset;
    const { imagePreviewUrls } = this.data;
    wx.previewImage({
      urls: imagePreviewUrls,
      current: imagePreviewUrls[index]
    });
  },

  /**
   * 编辑日记
   */
  editDiary() {
    if (this.data.isSharedView) return;
    const { date } = this.data;
    wx.navigateTo({
      url: `/pages/edit/edit?date=${date}`
    });
  },

  /**
   * 删除日记
   */
  deleteDiary() {
    if (this.data.isSharedView) return;
    wx.showModal({
      title: '删除日记',
      content: '确认删除这篇日记？删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#E25454',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          const { date } = this.data;
          // 删除关联的本地文件
          await this.deleteCloudFiles();
          this.deleteLocalFiles();
          await storage.deleteDiary(date);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 800);
        }
      }
    });
  },

  /**
   * 删除日记关联的本地文件
   */
  deleteLocalFiles() {
    const { diary } = this.data;
    if (!diary) return;

    const fs = wx.getFileSystemManager();
    const filesToDelete = [
      ...(diary.images || []),
      ...(diary.videos || [])
    ];

    filesToDelete.forEach(path => {
      if (path && path.startsWith(wx.env.USER_DATA_PATH)) {
        fs.unlink({ filePath: path, fail: () => {} });
      }
    });
  },

  /**
   * 删除云存储文件（最佳努力，不阻断主流程）。
   */
  async deleteCloudFiles() {
    const { diary } = this.data;
    if (!diary || !wx.cloud) return;

    const cloudFileList = [
      ...(diary.images || []),
      ...(diary.videos || [])
    ].filter(path => typeof path === 'string' && path.startsWith('cloud://'));

    if (cloudFileList.length === 0) return;

    try {
      await wx.cloud.deleteFile({ fileList: cloudFileList });
    } catch (err) {
      // 忽略云文件清理失败，避免影响日记记录删除。
    }
  },

  /**
   * 分享日记
   */
  onShareTap() {
    const { diary, dateDisplay } = this.data;
    const content = `${dateDisplay}\n${diary.weather ? diary.weather.icon + ' ' + diary.weather.text : ''}\n\n${diary.content}`;
    wx.setClipboardData({
      data: content,
      success() {
        wx.showToast({ title: '日记内容已复制', icon: 'success' });
      }
    });
  },

  onShareAppMessage() {
    return this.getShareConfig();
  },

  onShareTimeline() {
    const config = this.getShareConfig();
    const query = (config.path.split('?')[1] || '');
    return {
      title: config.title,
      query
    };
  }
});
