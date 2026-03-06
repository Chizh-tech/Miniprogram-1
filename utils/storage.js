/**
 * 日记数据存储服务
 * 使用微信本地存储持久化数据
 */

const STORAGE_KEY = 'diaries';

/**
 * 获取所有日记
 * @returns {Object} 以日期字符串为键的日记对象
 */
function getAllDiaries() {
  return wx.getStorageSync(STORAGE_KEY) || {};
}

/**
 * 根据日期获取日记
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Object|null}
 */
function getDiaryByDate(dateStr) {
  const diaries = getAllDiaries();
  return diaries[dateStr] || null;
}

/**
 * 根据 ID 获取日记
 * @param {string} id
 * @returns {Object|null}
 */
function getDiaryById(id) {
  const diaries = getAllDiaries();
  return Object.values(diaries).find(d => d.id === id) || null;
}

/**
 * 保存日记（新建或更新）
 * @param {Object} diary
 * @returns {Object} 保存后的日记对象
 */
function saveDiary(diary) {
  const diaries = getAllDiaries();
  diaries[diary.date] = diary;
  wx.setStorageSync(STORAGE_KEY, diaries);
  return diary;
}

/**
 * 删除日记
 * @param {string} dateStr - YYYY-MM-DD
 */
function deleteDiary(dateStr) {
  const diaries = getAllDiaries();
  delete diaries[dateStr];
  wx.setStorageSync(STORAGE_KEY, diaries);
}

/**
 * 获取某月有日记的日期列表
 * @param {number} year
 * @param {number} month - 1-indexed
 * @returns {string[]} 日期字符串数组
 */
function getDiaryDatesInMonth(year, month) {
  const diaries = getAllDiaries();
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return Object.keys(diaries).filter(d => d.startsWith(prefix));
}

/**
 * 获取所有日记列表，按日期倒序排列
 * @returns {Object[]}
 */
function getDiaryList() {
  const diaries = getAllDiaries();
  return Object.values(diaries).sort((a, b) => b.date.localeCompare(a.date));
}

module.exports = {
  getAllDiaries,
  getDiaryByDate,
  getDiaryById,
  saveDiary,
  deleteDiary,
  getDiaryDatesInMonth,
  getDiaryList
};
