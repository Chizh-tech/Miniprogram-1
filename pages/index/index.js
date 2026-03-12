const util = require('../../utils/util');
const storage = require('../../utils/storage');

const DIVE_STATUS_META = {
  want: { value: 'want', label: '想去潜水', icon: '○', className: 'status-want', colorText: '蓝色', detail: '蓝色 + ○：想去潜水' },
  depart: { value: 'depart', label: '出发潜水', icon: '▲', className: 'status-depart', colorText: '橙色', detail: '橙色 + ▲：出发潜水' },
  diving: { value: 'diving', label: '正在潜水', icon: '●', className: 'status-diving', colorText: '绿色', detail: '绿色 + ●：正在潜水' },
  return: { value: 'return', label: '潜水归来', icon: '★', className: 'status-return', colorText: '紫色', detail: '紫色 + ★：潜水归来' }
};

Page({
  data: {
    // 当前显示的年月
    currentYear: 0,
    currentMonth: 0,
    // 月份名称
    monthName: '',
    // 日历格子数据
    calendarDays: [],
    // 当月有日记的日期集合
    diaryDates: {},
    // 选中的日期
    selectedDate: '',
    // 日记列表（当月）
    diaryList: [],
    // 视图模式：calendar | list
    viewMode: 'calendar',
    // 星期表头
    weekHeaders: ['日', '一', '二', '三', '四', '五', '六'],
    statusLegend: Object.values(DIVE_STATUS_META)
  },

  getDiveStatusMeta(status) {
    return DIVE_STATUS_META[status] || null;
  },

  onLoad() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      selectedDate: util.formatDate(now)
    });
    this.renderCalendar();
  },

  async onShow() {
    // 每次显示页面时刷新（日记可能有增减）
    await this.renderCalendar();
    await this.loadDiaryList();
  },

  /**
   * 渲染当前月份日历
   */
  async renderCalendar() {
    const { currentYear, currentMonth } = this.data;
    const calendarDays = util.getCalendarDays(currentYear, currentMonth);
    const diaryList = await storage.getDiaryList();
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}-`;
    const monthList = diaryList.filter(d => d && d.date && d.date.startsWith(monthPrefix));

    // 转为 Set 方便查找
    const diaryDates = {};
    const diaryStatusMetaMap = {};
    monthList.forEach(d => {
      diaryDates[d.date] = true;
      diaryStatusMetaMap[d.date] = this.getDiveStatusMeta(d.diveStatus);
    });

    // 标记有日记的日期
    calendarDays.forEach(day => {
      if (!day.empty) {
        const statusMeta = diaryStatusMetaMap[day.dateStr] || null;
        day.hasDiary = !!diaryDates[day.dateStr];
        day.isSelected = day.dateStr === this.data.selectedDate;
        day.statusClassName = statusMeta ? statusMeta.className : 'status-default';
        day.statusIcon = statusMeta ? statusMeta.icon : '•';
      }
    });

    const monthName = `${currentYear}年${currentMonth}月`;

    this.setData({ calendarDays, diaryDates, monthName });
  },

  /**
   * 加载日记列表（日历模式：当月；列表模式：全部）
   */
  async loadDiaryList() {
    const { currentYear, currentMonth, viewMode } = this.data;
    let list = await storage.getDiaryList();

    if (viewMode === 'calendar') {
      const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}-`;
      list = list.filter(d => d.date.startsWith(prefix));
    }

    // 兼容旧数据：补齐空字段，避免模板访问 undefined.length 导致渲染异常。
    list = list
      .filter(d => d && d.date)
      .map(d => {
        const parts = d.date.split('-');
        const statusMeta = this.getDiveStatusMeta(d.diveStatus);
        return Object.assign({
          title: '',
          content: '',
          images: [],
          videos: [],
          location: null,
          weather: null
        }, d, {
          dayNum: parts[2] || '',
          monthYear: (parts[0] && parts[1]) ? `${parts[1]}/${parts[0]}` : '',
          diveStatusMeta: statusMeta,
          diveStatusClassName: statusMeta ? statusMeta.className : '',
          diveStatusIcon: statusMeta ? statusMeta.icon : '',
          diveStatusLabel: statusMeta ? statusMeta.label : ''
        });
      });

    this.setData({ diaryList: list });
  },

  /**
   * 切换到上一个月
   */
  async prevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    this.setData({ currentYear, currentMonth, selectedDate: '' });
    await this.renderCalendar();
    await this.loadDiaryList();
  },

  /**
   * 切换到下一个月
   */
  async nextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    this.setData({ currentYear, currentMonth, selectedDate: '' });
    await this.renderCalendar();
    await this.loadDiaryList();
  },

  /**
   * 回到今天
   */
  async goToday() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      selectedDate: util.formatDate(now)
    });
    await this.renderCalendar();
    await this.loadDiaryList();
  },

  /**
   * 点击日期格子
   */
  async onDayTap(e) {
    const { dateStr, empty } = e.currentTarget.dataset;
    if (empty || !dateStr) return;

    this.setData({ selectedDate: dateStr });
    await this.renderCalendar();

    const diary = await storage.getDiaryByDate(dateStr);
    if (diary) {
      // 已有日记 → 查看详情
      wx.navigateTo({
        url: `/pages/detail/detail?date=${dateStr}`
      });
    } else {
      // 无日记 → 询问是否新建
      wx.showModal({
        title: dateStr,
        content: '这一天还没有潜水日志，是否创建？',
        confirmText: '去记录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: `/pages/edit/edit?date=${dateStr}`
            });
          }
        }
      });
    }
  },

  /**
   * 点击新建按钮（今天）
   */
  onCreateTap() {
    const today = util.formatDate(new Date());
    wx.navigateTo({
      url: `/pages/edit/edit?date=${today}`
    });
  },

  /**
   * 点击日记列表项
   */
  onDiaryItemTap(e) {
    const { date } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/detail/detail?date=${date}`
    });
  },

  /**
   * 切换视图模式
   */
  switchView(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ viewMode: mode }, () => {
      this.loadDiaryList();
    });
  }
});
