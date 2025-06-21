// semantic search

const { MongoClient } = require("mongodb");

const config = {
  mongoUri:
    "your-uri",
  dbName: "sample_mflix",
  collectionName: "movies",
  openaiApiKey:
    "your-api-key",
  batchSize: 10, // Process documents in batches
  delayBetweenRequests: 1000, // 1 second delay between API calls
  embeddingModel: "text-embedding-3-small",
};

const query = "A movie about people going to space";
console.log("Query: ", query);

const embeddings = getEmbeddings(
  query,
  config.embeddingModel,
  config.openaiApiKey
);

async function getEmbeddings(text, model, apiKey) {
  const url = "https://api.openai.com/v1/embeddings";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model: model,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API Error: ${response.status} - ${error}`);
  }

  const responseData = await response.json();
  return responseData.data[0].embedding;
}

// Main semantic search function
async function performSemanticSearch() {
  let client;

  try {
    // Connect to MongoDB
    client = new MongoClient(config.mongoUri);
    await client.connect();

    const db = client.db(config.dbName);
    const collection = db.collection(config.collectionName);

    console.log("Getting embeddings for query...");
    // Get embeddings for the query
    const queryEmbedding = await getEmbeddings(
      query,
      config.embeddingModel,
      config.openaiApiKey
    );

    console.log("Performing vector search...");
    // Create the aggregation pipeline
    const pipeline = [
      {
        $vectorSearch: {
          index: "vectorPlotIndex",
          path: "plot_embedding",
          queryVector: queryEmbedding,
          numCandidates: 100,
          //   filter: {"year": {"$gt": 2010}},
          limit: 10,
        },
      },
      {
        $project: {
          title: 1,
          plot: 1,
          year: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    // Execute the search
    const results = await collection.aggregate(pipeline).toArray();

    console.log(`\nFound ${results.length} similar movies:\n`);

    // Display results
    results.forEach((movie, index) => {
      console.log(`${index + 1}. ${movie.title} (${movie.year || "N/A"})`);
      console.log(`   Score: ${movie.score.toFixed(4)}`);
      console.log(
        `   Plot: ${
          movie.plot
            ? movie.plot
            : // ? movie.plot.substring(0, 200) + "..."
              "No plot available"
        }`
      );
      console.log("");
    });
  } catch (error) {
    console.error("Error performing semantic search:", error);
  } finally {
    // Close the connection
    if (client) {
      await client.close();
    }
  }
}

// Run the semantic search
performSemanticSearch();
