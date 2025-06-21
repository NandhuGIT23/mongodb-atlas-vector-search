db.movies.createSearchIndex("vectorPlotIndex", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "plot_embedding",
      numDimensions: 1536,
      similarity: "cosine",
    },
    {
      type: "filter",
      path: "year",
    },
  ],
});
