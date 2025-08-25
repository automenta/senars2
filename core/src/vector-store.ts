// A simple cosine distance function
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must be of the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface VectorStore {
  initIndex(maxElements: number): void;
  addPoint(point: number[], label: number): void;
  searchKnn(query: number[], k: number): { distances: number[]; neighbors: number[] };
}

interface StoredVector {
  point: number[];
  label: number;
}

export class BruteForceVectorStore implements VectorStore {
  private vectors: StoredVector[] = [];
  private isInitialized = false;

  initIndex(maxElements: number): void {
    // In this brute-force implementation, we don't need to pre-allocate anything.
    // We just mark it as initialized.
    this.vectors = [];
    this.isInitialized = true;
  }

  addPoint(point: number[], label: number): void {
    if (!this.isInitialized) {
      throw new Error('Vector store must be initialized before adding points.');
    }
    this.vectors.push({ point, label });
  }

  searchKnn(query: number[], k: number): { distances: number[]; neighbors: number[] } {
    if (!this.isInitialized) {
      throw new Error('Vector store must be initialized before searching.');
    }

    if (k > this.vectors.length) {
      k = this.vectors.length;
    }

    const similarities = this.vectors.map(v => ({
      similarity: cosineSimilarity(query, v.point),
      label: v.label,
    }));

    similarities.sort((a, b) => b.similarity - a.similarity); // Sort descending by similarity

    const topK = similarities.slice(0, k);

    return {
      distances: topK.map(v => 1 - v.similarity), // Convert similarity to distance
      neighbors: topK.map(v => v.label),
    };
  }
}
