export abstract class EmbeddingPort {
  abstract embed(text: string): Promise<Float64Array>;
}
