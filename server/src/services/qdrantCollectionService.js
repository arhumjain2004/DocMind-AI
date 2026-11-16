
const qdrant = require("./qdrantService");

const COLLECTION_NAME = "docmind_chunks";
const VECTOR_SIZE = 384;

const createPayloadIndexIfMissing = async (fieldName) => {
  const collection = await qdrant.getCollection(
    COLLECTION_NAME
  );

  const payloadSchema = collection.payload_schema || {};

  if (payloadSchema[fieldName]) {
    console.log(
      `Qdrant payload index for "${fieldName}" already exists`
    );
    return;
  }

  await qdrant.createPayloadIndex(
    COLLECTION_NAME,
    {
      field_name: fieldName,
      field_schema: "keyword",
      wait: true,
    }
  );

  console.log(
    `Qdrant payload index for "${fieldName}" created successfully`
  );
};

const createCollection = async () => {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.some(
    (collection) =>
      collection.name === COLLECTION_NAME
  );

  if (!exists) {
    await qdrant.createCollection(
      COLLECTION_NAME,
      {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      }
    );

    console.log(
      `Qdrant collection "${COLLECTION_NAME}" created successfully`
    );
  } else {
    console.log(
      `Qdrant collection "${COLLECTION_NAME}" already exists`
    );
  }

  // Ensure both filter indexes exist, even for an
  // already-created collection.
  await createPayloadIndexIfMissing("userId");
  await createPayloadIndexIfMissing("documentId");
};

module.exports = {
  COLLECTION_NAME,
  createCollection,
};