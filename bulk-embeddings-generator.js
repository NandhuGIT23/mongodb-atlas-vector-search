// Bulk Vector Embedding Generator for MongoDB Collection
// This script processes all documents in your collection and adds embeddings

const { MongoClient } = require("mongodb");

// Configuration
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

// Function to get embeddings from OpenAI
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

// Function to add delay between requests
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main function to process all documents
async function processAllDocuments() {
  let client;

  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    client = new MongoClient(config.mongoUri);
    await client.connect();

    const db = client.db(config.dbName);
    const collection = db.collection(config.collectionName);

    // Get total count
    const totalDocs = await collection.countDocuments({
      plot: { $exists: true, $ne: "" }, // Only documents with plot
      plot_embedding: { $exists: false }, // Without existing embeddings
    });

    console.log(`Found ${totalDocs} documents to process`);

    if (totalDocs === 0) {
      console.log("No documents need processing. Exiting.");
      return;
    }

    let processed = 0;
    let errors = 0;

    // Process documents in batches
    const cursor = collection.find({
      plot: { $exists: true, $ne: "" },
      plot_embedding: { $exists: false },
    });

    while (await cursor.hasNext()) {
      const batchPromises = [];

      // Create batch of documents
      for (let i = 0; i < config.batchSize && (await cursor.hasNext()); i++) {
        const doc = await cursor.next();
        batchPromises.push(processDocument(collection, doc));
      }

      // Process batch
      const results = await Promise.allSettled(batchPromises);

      // Count results
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          processed++;
        } else {
          errors++;
          console.error("Error processing document:", result.reason);
        }
      });

      console.log(
        `Progress: ${processed}/${totalDocs} processed, ${errors} errors`
      );

      // Delay between batches to avoid rate limiting
      if (processed < totalDocs) {
        await delay(config.delayBetweenRequests);
      }
    }

    console.log(
      `\n✅ Completed! ${processed} documents processed, ${errors} errors`
    );
  } catch (error) {
    console.error("Script error:", error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Function to process a single document
async function processDocument(collection, doc) {
  try {
    console.log(`Processing: ${doc.title || doc._id}`);

    // Generate embedding
    const embedding = await getEmbeddings(
      doc.plot,
      config.embeddingModel,
      config.openaiApiKey
    );

    // Update document with embedding
    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          plot_embedding: embedding,
          embedding_generated_at: new Date(),
        },
      }
    );

    console.log(`✅ Updated: ${doc.title || doc._id}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to process ${doc.title || doc._id}:`,
      error.message
    );
    throw error;
  }
}

// Error handling for rate limits
async function handleRateLimit(error, retryCount = 0) {
  if (error.message.includes("429") && retryCount < 3) {
    const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
    console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
    await delay(waitTime);
    return true;
  }
  return false;
}

// Run the script
console.log("🚀 Starting bulk embedding generation...");
console.log(`Configuration:
- Database: ${config.dbName}
- Collection: ${config.collectionName}
- Model: ${config.embeddingModel}
- Batch Size: ${config.batchSize}
- Delay: ${config.delayBetweenRequests}ms
`);

processAllDocuments().catch(console.error);

// Usage Instructions:
// 1. Install dependencies: npm install mongodb
// 2. Update the config object with your MongoDB connection string and OpenAI API key
// 3. Run: node bulk-embedding-generator.js
