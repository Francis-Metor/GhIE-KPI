// Schema plugin: documents can be created but never changed or removed through Mongoose.
// This protects the point ledger and audit log from accidental edits. It does not stop someone with
// direct database access; use a restricted Atlas user for the app in production.
const BLOCKED = ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne',
  'deleteOne', 'deleteMany', 'findOneAndDelete'];

module.exports = function appendOnly(schema, label) {
  const fail = () => { throw new Error(`${label} is append-only: records cannot be modified or deleted.`); };
  BLOCKED.forEach((op) => schema.pre(op, { query: true, document: false }, fail));
  schema.pre('deleteOne', { document: true, query: false }, fail);
  schema.pre('save', function () { if (!this.isNew) fail(); });
};
