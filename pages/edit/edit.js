const util = require('../../utils/util');
const storage = require('../../utils/storage');
const weatherService = require('../../utils/weather');
const locationService = require('../../utils/location');

Page({
  data: {
    date: '',
    dateDisplay: '',
    weekday: '',
    title: '',
    content: '',
    images: [],
    videos: [],
    location: null,
    weather: null,
    isLoadingLocation: false,
    isLoadingWeather: false,
    isExistingDiary: false,
    isSaving: false,
    showDebugPanel: false,
    debugInfo: {
      lastRefreshAt: '-',
      locationPermission: '未知',
      locationStatus: '未开始',
      locationError: '-',
      locationRaw: '-',
      locationResult: '-',
      locationGeocodeStatus: '-',
      locationGeocodeReason: '-',
      locationGeocodeHttp: '-',
      locationGeocodeApiStatus: '-',
      locationGeocodeApiMessage: '-',
      locationGeocodeRaw: '-',
      weatherStatus: '未开始',
      weatherError: '-',
      weatherResult: '-',
      weatherHttpStatus: '-',
      weatherApiCode: '-',
      weatherApiMessage: '-',
      weatherRaw: '-',
      hasWeatherKey: false,
      hasTencentMapKey: false
    }
  },

  async onLoad(options) {
    const date = options.date || util.formatDate(new Date());
    const dateObj = util.parseDate(date);
    const dateDisplay = `${date}  ${util.getWeekdayName(dateObj.getDay())}`;

    this.setData({
      date,
      dateDisplay,
      'debugInfo.hasWeatherKey': !!weatherService.__DEBUG_HAS_WEATHER_KEY__,
      'debugInfo.hasTencentMapKey': !!locationService.__DEBUG_HAS_MAP_KEY__
    });

    this.refreshLocationPermission();

    // 检查是否已有该日期的日记（编辑模式）
    const existing = await storage.getDiaryByDate(date);
    if (existing) {
      this.setData({
        title: existing.title || '',
        content: existing.content || '',
        images: existing.images || [],
        videos: existing.videos || [],
        location: existing.location || null,
        weather: existing.weather || null,
        isExistingDiary: true
      });

      // 历史日记缺少位置/天气信息时自动补拉一次
      if (!existing.location || !existing.weather) {
        this.autoFetchLocationAndWeather();
      }
    } else {
      // 新建模式，自动获取位置和天气
      this.autoFetchLocationAndWeather();
    }
  },

  onShow() {
    wx.setNavigationBarTitle({
      title: this.data.isExistingDiary ? '编辑日记' : '写日记'
    });

    this.refreshLocationPermission();
  },

  toggleDebugPanel() {
    this.setData({ showDebugPanel: !this.data.showDebugPanel });
  },

  refreshLocationPermission() {
    wx.getSetting({
      success: (res) => {
        const auth = res && res.authSetting ? res.authSetting['scope.userLocation'] : undefined;
        const permissionText = auth === true ? '已授权' : (auth === false ? '已拒绝' : '未请求');
        this.setData({ 'debugInfo.locationPermission': permissionText });
      },
      fail: () => {
        this.setData({ 'debugInfo.locationPermission': '读取失败' });
      }
    });
  },

  /**
   * 自动获取位置和天气
   */
  autoFetchLocationAndWeather() {
    const now = util.formatDateTime(new Date());
    this.setData({
      isLoadingLocation: true,
      isLoadingWeather: true,
      'debugInfo.lastRefreshAt': now,
      'debugInfo.locationStatus': '请求中',
      'debugInfo.locationError': '-',
      'debugInfo.locationRaw': '-',
      'debugInfo.locationGeocodeStatus': '-',
      'debugInfo.locationGeocodeReason': '-',
      'debugInfo.locationGeocodeHttp': '-',
      'debugInfo.locationGeocodeApiStatus': '-',
      'debugInfo.locationGeocodeApiMessage': '-',
      'debugInfo.locationGeocodeRaw': '-',
      'debugInfo.weatherStatus': '等待定位结果',
      'debugInfo.weatherError': '-',
      'debugInfo.weatherResult': '-',
      'debugInfo.weatherHttpStatus': '-',
      'debugInfo.weatherApiCode': '-',
      'debugInfo.weatherApiMessage': '-',
      'debugInfo.weatherRaw': '-'
    });

    locationService.getCurrentLocation()
      .then(loc => {
        const geoDebug = loc && loc.geocodeDebug ? loc.geocodeDebug : {};
        this.setData({
          location: loc,
          isLoadingLocation: false,
          'debugInfo.locationStatus': '成功',
          'debugInfo.locationResult': `${loc.latitude}, ${loc.longitude} (${loc.name})`,
          'debugInfo.locationGeocodeStatus': geoDebug.ok ? '成功' : '失败',
          'debugInfo.locationGeocodeReason': geoDebug.reason || '-',
          'debugInfo.locationGeocodeHttp': geoDebug.httpStatus !== undefined ? `${geoDebug.httpStatus}` : '-',
          'debugInfo.locationGeocodeApiStatus': geoDebug.apiStatus !== undefined ? `${geoDebug.apiStatus}` : '-',
          'debugInfo.locationGeocodeApiMessage': geoDebug.apiMessage || '-',
          'debugInfo.locationGeocodeRaw': geoDebug.networkError || '-',
          'debugInfo.weatherStatus': '请求中'
        });
        // 用位置获取天气
        return weatherService.getWeather(loc.latitude, loc.longitude);
      })
      .then(weather => {
        const weatherDebug = weather && weather.debug ? weather.debug : {};
        const isWeatherFailed = !weather || weather.temperature === '--' || weatherDebug.ok === false;
        this.setData({
          weather,
          isLoadingWeather: false,
          'debugInfo.weatherStatus': isWeatherFailed ? '失败' : '成功',
          'debugInfo.weatherResult': `${weather.icon || ''} ${weather.text || ''} ${weather.temperature || '--'}°C`,
          'debugInfo.weatherHttpStatus': weatherDebug.httpStatus !== undefined ? `${weatherDebug.httpStatus}` : '-',
          'debugInfo.weatherApiCode': weatherDebug.apiCode !== undefined ? `${weatherDebug.apiCode}` : '-',
          'debugInfo.weatherApiMessage': weatherDebug.apiMessage || '-',
          'debugInfo.weatherRaw': weatherDebug.networkError || '-'
        });

        if (isWeatherFailed) {
          this.setData({ 'debugInfo.weatherError': weather.text || '天气获取失败' });
          wx.showToast({ title: weather.text || '天气获取失败', icon: 'none' });
        }
      })
      .catch((err) => {
        this.setData({
          isLoadingLocation: false,
          isLoadingWeather: false,
          'debugInfo.locationStatus': '失败',
          'debugInfo.weatherStatus': '未执行',
          'debugInfo.locationError': (err && err.message) || '定位失败',
          'debugInfo.locationRaw': (err && err.raw && err.raw.errMsg) ? err.raw.errMsg : '-'
        });
        if (err && err.type === 'AUTH_DENIED') {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置中开启“位置信息”权限后重试。',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting({
                  success: () => {
                    this.refreshLocationPermission();
                  }
                });
              }
            }
          });
          return;
        }

        wx.showToast({ title: (err && err.message) || '定位失败，请重试', icon: 'none' });
      });
  },

  /**
   * 手动刷新位置和天气
   */
  refreshLocationWeather() {
    this.refreshLocationPermission();
    this.autoFetchLocationAndWeather();
  },

  /**
   * 标题输入
   */
  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  /**
   * 内容输入
   */
  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  /**
   * 选择图片
   */
  chooseImages() {
    const currentCount = this.data.images.length;
    const maxCount = 9 - currentCount;
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传9张图片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(f => f.tempFilePath);
        // 保存图片到本地文件系统
        this.saveFilesToLocal(newImages, 'image');
      },
      fail: () => {}
    });
  },

  /**
   * 选择视频
   */
  chooseVideo() {
    const currentCount = this.data.videos.length;
    if (currentCount >= 3) {
      wx.showToast({ title: '最多上传3个视频', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        this.saveFilesToLocal([tempPath], 'video');
      },
      fail: () => {}
    });
  },

  /**
   * 保存临时文件到本地文件系统（持久化）
   * @param {string[]} tempPaths
   * @param {'image'|'video'} type
   */
  saveFilesToLocal(tempPaths, type) {
    const fs = wx.getFileSystemManager();
    const savedPaths = [];
    let completed = 0;

    wx.showLoading({ title: '处理中...' });

    tempPaths.forEach(tempPath => {
      const ext = type === 'image' ? '.jpg' : '.mp4';
      const savedPath = `${wx.env.USER_DATA_PATH}/${util.generateId()}${ext}`;

      fs.copyFile({
        srcPath: tempPath,
        destPath: savedPath,
        success: () => {
          savedPaths.push(savedPath);
          completed++;
          if (completed === tempPaths.length) {
            wx.hideLoading();
            if (type === 'image') {
              this.setData({ images: [...this.data.images, ...savedPaths] });
            } else {
              this.setData({ videos: [...this.data.videos, ...savedPaths] });
            }
          }
        },
        fail: () => {
          // 保存失败时直接使用临时路径（会话内有效）
          savedPaths.push(tempPath);
          completed++;
          if (completed === tempPaths.length) {
            wx.hideLoading();
            if (type === 'image') {
              this.setData({ images: [...this.data.images, ...savedPaths] });
            } else {
              this.setData({ videos: [...this.data.videos, ...savedPaths] });
            }
          }
        }
      });
    });
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const { index } = e.currentTarget.dataset;
    const { images } = this.data;
    wx.previewImage({
      urls: images,
      current: images[index]
    });
  },

  /**
   * 删除图片
   */
  deleteImage(e) {
    const { index } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除图片',
      content: '确认删除这张图片？',
      success: (res) => {
        if (res.confirm) {
          const images = [...this.data.images];
          images.splice(index, 1);
          this.setData({ images });
        }
      }
    });
  },

  /**
   * 删除视频
   */
  deleteVideo(e) {
    const { index } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除视频',
      content: '确认删除这段视频？',
      success: (res) => {
        if (res.confirm) {
          const videos = [...this.data.videos];
          videos.splice(index, 1);
          this.setData({ videos });
        }
      }
    });
  },

  /**
   * 保存日记
   */
  async saveDiary() {
    const { date, title, content, images, videos, location, weather } = this.data;

    if (!content.trim() && !title.trim() && images.length === 0 && videos.length === 0) {
      wx.showToast({ title: '日记内容不能为空', icon: 'none' });
      return;
    }

    this.setData({ isSaving: true });

    const now = new Date();
    const diary = {
      id: util.generateId(),
      date,
      title: title.trim(),
      content: content.trim(),
      images,
      videos,
      location,
      weather,
      createdAt: util.formatDateTime(now),
      updatedAt: util.formatDateTime(now)
    };

    // 如果是编辑模式，保留原 id 和 createdAt
    const existing = await storage.getDiaryByDate(date);
    if (existing) {
      diary.id = existing.id;
      diary.createdAt = existing.createdAt;
    }

    try {
      await storage.saveDiary(diary);
      this.setData({ isSaving: false });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (err) {
      this.setData({ isSaving: false });
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  /**
   * 放弃并返回
   */
  onBack() {
    wx.showModal({
      title: '提示',
      content: '确认放弃本次编辑？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        }
      }
    });
  }
});
