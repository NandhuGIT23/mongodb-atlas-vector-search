// to delete 20000 sample documents from sample db. (db: sample_mflix, collection: movies)

const batchSize = 1000;

try {
  let docs = db.movies.find().sort({ _id: 1 }).limit(10000).toArray();
  print(`Found ${docs.length} docs to delete`);

  for (let i = 0; i < docs.length; i += batchSize) {
    let batch = docs.slice(i, i + batchSize).map((doc) => ({
      deleteOne: { filter: { _id: doc._id } },
    }));

    db.movies.bulkWrite(batch);
    print(`Deleted batch ${i / batchSize + 1}`);
  }

  print("✅ Finished bulk deletion");
} catch (e) {
  print("❌ Error:", e.message);
}
