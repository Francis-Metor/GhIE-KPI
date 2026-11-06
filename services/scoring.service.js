const mongoose = require('mongoose');
const { Category, Criterion, AuditLog } = require('../models');
const { HttpError } = require('../lib/http');

const text = (value) => String(value ?? '').trim();

async function findCategory(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Category not found.');
  const category = await Category.findById(id);
  if (!category) throw new HttpError(404, 'Category not found.');
  return category;
}

async function findCriterion(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Criterion not found.');
  const criterion = await Criterion.findById(id);
  if (!criterion) throw new HttpError(404, 'Criterion not found.');
  return criterion;
}

async function listScoring() {
  const [categories, criteria] = await Promise.all([
    Category.find().sort({ displayOrder: 1, name: 1 }).lean(),
    Criterion.find().populate('category', 'name').sort({ name: 1 }).lean(),
  ]);
  return { categories, criteria };
}

async function createCategory(input, actor) {
  const category = await Category.create({
    name: text(input.name),
    description: text(input.description),
    displayOrder: input.displayOrder === '' || input.displayOrder === undefined ? 0 : Number(input.displayOrder),
    isActive: input.isActive !== false,
  });
  await AuditLog.create({ actor: actor._id, actorRole: 'admin', action: 'category.create', targetType: 'Category', targetId: category._id, summary: `Category ${category.name} created` });
  return category;
}

async function updateCategory(id, input, actor) {
  const category = await findCategory(id);
  if (input.name !== undefined) category.name = text(input.name);
  if (input.description !== undefined) category.description = text(input.description);
  if (input.displayOrder !== undefined) category.displayOrder = Number(input.displayOrder);
  if (input.isActive !== undefined) category.isActive = Boolean(input.isActive);
  await category.save();
  await AuditLog.create({ actor: actor._id, actorRole: 'admin', action: 'category.update', targetType: 'Category', targetId: category._id, summary: `Category ${category.name} updated` });
  return category;
}

async function createCriterion(input, actor) {
  const category = await findCategory(input.category);
  const criterion = await Criterion.create({
    name: text(input.name),
    description: text(input.description),
    category: category._id,
    points: Number(input.points),
    awardMethod: input.awardMethod,
    isActive: input.isActive !== false,
    awardLimit: input.awardLimit === '' || input.awardLimit === undefined ? null : Number(input.awardLimit),
    createdBy: actor._id,
  });
  await AuditLog.create({ actor: actor._id, actorRole: 'admin', action: 'criterion.create', targetType: 'Criterion', targetId: criterion._id, summary: `Criterion ${criterion.name} created` });
  return criterion;
}

async function updateCriterion(id, input, actor) {
  const criterion = await findCriterion(id);
  if (input.category !== undefined) criterion.category = (await findCategory(input.category))._id;
  if (input.name !== undefined) criterion.name = text(input.name);
  if (input.description !== undefined) criterion.description = text(input.description);
  if (input.points !== undefined) criterion.points = Number(input.points);
  if (input.awardMethod !== undefined) criterion.awardMethod = input.awardMethod;
  if (input.isActive !== undefined) criterion.isActive = Boolean(input.isActive);
  if (input.awardLimit !== undefined) criterion.awardLimit = input.awardLimit === '' ? null : Number(input.awardLimit);
  await criterion.save();
  await AuditLog.create({ actor: actor._id, actorRole: 'admin', action: 'criterion.update', targetType: 'Criterion', targetId: criterion._id, summary: `Criterion ${criterion.name} updated` });
  return criterion;
}

module.exports = { listScoring, createCategory, updateCategory, createCriterion, updateCriterion };
