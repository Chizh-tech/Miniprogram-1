/**
 * 日记数据存储服务
 * 优先使用腾讯云开发数据库，未配置时回退到本地存储
 */

const config = require('../config');

const STORAGE_KEY = 'diaries';
const DEFAULT_COLLECTION = 'diaries';
const PAGE_LIMIT = 100;

function isCloudEnabled() {
  return !!(wx.cloud && config.CLOUD_ENV_ID);
}

function getCollectionName() {
  return config.DIARY_COLLECTION || DEFAULT_COLLECTION;
}

function getCloudDb() {
  if (!isCloudEnabled()) return null;
  return wx.cloud.database();
}

function toCloudPayload(diary) {
  const { _id, _openid, ...rest } = diary;
  return rest;
}

async function getCloudDiaryList() {
  const db = getCloudDb();
  const collectionName = getCollectionName();
  const countRes = await db.collection(collectionName).count();
  const total = countRes.total || 0;
  const tasks = [];

  for (let skip = 0; skip < total; skip += PAGE_LIMIT) {
    tasks.push(
      db.collection(collectionName)
        .orderBy('date', 'desc')
        .skip(skip)
        .limit(PAGE_LIMIT)
        .get()
    );
  }

  if (tasks.length === 0) return [];
  const pages = await Promise.all(tasks);
  return pages.flatMap(page => page.data || []);
}

/**
 * 获取所有日记
 * @returns {Object} 以日期字符串为键的日记对象
 */
async function getAllDiaries() {
  const localRaw = wx.getStorageSync(STORAGE_KEY) || {};
  const localMap = Array.isArray(localRaw)
    ? localRaw.reduce((acc, item) => {
      if (item && item.date) acc[item.date] = item;
      return acc;
    }, {})
    : localRaw;

  if (isCloudEnabled()) {
    const list = await getCloudDiaryList();
    const cloudMap = {};
    list.forEach(item => {
      if (item && item.date) {
        cloudMap[item.date] = item;
      }
    });

    // 兼容旧版本：云端优先，但保留仅存在于本地的历史日记。
    return Object.assign({}, localMap, cloudMap);
  }

  return localMap;
}

/**
 * 根据日期获取日记
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Object|null}
 */
async function getDiaryByDate(dateStr) {
  if (isCloudEnabled()) {
    const db = getCloudDb();
    const collectionName = getCollectionName();
    const res = await db.collection(collectionName).where({ date: dateStr }).limit(1).get();
    return (res.data && res.data[0]) || null;
  }

  const diaries = await getAllDiaries();
  return diaries[dateStr] || null;
}

/**
 * 根据 ID 获取日记
 * @param {string} id
 * @returns {Object|null}
 */
async function getDiaryById(id) {
  if (isCloudEnabled()) {
    const db = getCloudDb();
    const collectionName = getCollectionName();
    const res = await db.collection(collectionName).where({ id }).limit(1).get();
    return (res.data && res.data[0]) || null;
  }

  const diaries = await getAllDiaries();
  return Object.values(diaries).find(d => d.id === id) || null;
}

/**
 * 保存日记（新建或更新）
 * @param {Object} diary
 * @returns {Object} 保存后的日记对象
 */
async function saveDiary(diary) {
  if (isCloudEnabled()) {
    const db = getCloudDb();
    const collectionName = getCollectionName();
    const existed = await getDiaryByDate(diary.date);
    const payload = toCloudPayload(diary);

    if (existed && existed._id) {
      await db.collection(collectionName).doc(existed._id).set({ data: payload });
    } else {
      await db.collection(collectionName).add({ data: payload });
    }

    return diary;
  }

  const diaries = await getAllDiaries();
  diaries[diary.date] = diary;
  wx.setStorageSync(STORAGE_KEY, diaries);
  return diary;
}

/**
 * 删除日记
 * @param {string} dateStr - YYYY-MM-DD
 */
async function deleteDiary(dateStr) {
  if (isCloudEnabled()) {
    const db = getCloudDb();
    const collectionName = getCollectionName();
    const res = await db.collection(collectionName).where({ date: dateStr }).get();
    const docs = res.data || [];
    await Promise.all(docs.map(doc => db.collection(collectionName).doc(doc._id).remove()));
    return;
  }

  const diaries = await getAllDiaries();
  delete diaries[dateStr];
  wx.setStorageSync(STORAGE_KEY, diaries);
}

/**
 * 获取某月有日记的日期列表
 * @param {number} year
 * @param {number} month - 1-indexed
 * @returns {string[]} 日期字符串数组
 */
async function getDiaryDatesInMonth(year, month) {
  const diaries = await getAllDiaries();
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return Object.keys(diaries).filter(d => d.startsWith(prefix));
}

/**
 * 获取所有日记列表，按日期倒序排列
 * @returns {Object[]}
 */
async function getDiaryList() {
  const diaries = await getAllDiaries();
  return Object.values(diaries)
    .filter(item => item && item.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
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
