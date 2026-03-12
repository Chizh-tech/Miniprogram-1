const util = require('../../utils/util');
const storage = require('../../utils/storage');

const DIVE_STATUS_META = {
  want: { value: 'want', label: '想去潜水', icon: '○', className: 'status-want' },
  depart: { value: 'depart', label: '出发潜水', icon: '▲', className: 'status-depart' },
  diving: { value: 'diving', label: '正在潜水', icon: '●', className: 'status-diving' },
  return: { value: 'return', label: '潜水归来', icon: '★', className: 'status-return' }
};

Page({
  data: {
    diary: null,
    date: '',
    dateDisplay: '',
    currentVideoIndex: -1,
    imagePreviewUrls: [],
    videoPreviewUrls: []
  },

  getDiveStatusMeta(status) {
    return DIVE_STATUS_META[status] || null;
  },

  async onLoad(options) {
    const date = options.date;
    this.setData({ date });
    await this.loadDiary();
  },

  async onShow() {
    await this.loadDiary();
  },

  /**
   * 加载日记数据
   */
  async loadDiary() {
    const { date } = this.data;
    const diary = await storage.getDiaryByDate(date);
    if (!diary) {
      wx.showToast({ title: '潜水日志不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }

    const dateObj = util.parseDate(date);
    const dateDisplay = `${date}  ${util.getWeekdayName(dateObj.getDay())}`;

    wx.setNavigationBarTitle({ title: diary.title || '潜水日志详情' });

    const statusMeta = this.getDiveStatusMeta(diary.diveStatus);
    const diaryWithStatus = Object.assign({}, diary, {
      diveStatusMeta: statusMeta,
      diveStatusClassName: statusMeta ? statusMeta.className : '',
      diveStatusIcon: statusMeta ? statusMeta.icon : '',
      diveStatusLabel: statusMeta ? statusMeta.label : ''
    });

    const imagePreviewUrls = await this.resolveFileUrls(diary.images || []);
    const videoPreviewUrls = await this.resolveFileUrls(diary.videos || []);

    this.setData({ diary: diaryWithStatus, dateDisplay, imagePreviewUrls, videoPreviewUrls });
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
    const { date } = this.data;
    wx.navigateTo({
      url: `/pages/edit/edit?date=${date}`
    });
  },

  /**
   * 删除日记
   */
  deleteDiary() {
    wx.showModal({
      title: '删除潜水日志',
      content: '确认删除这篇潜水日志？删除后不可恢复。',
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
  }
});
