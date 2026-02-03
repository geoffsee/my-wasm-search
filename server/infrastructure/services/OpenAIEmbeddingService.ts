import { Container as Service } from 'di-framework/decorators';
import OpenAI from 'openai';
import { EmbeddingPort } from '../../domain/ports/EmbeddingPort';

@Service()
export class OpenAIEmbeddingService extends EmbeddingPort {
  private client: OpenAI;

  constructor() {
    super();
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async embed(text: string): Promise<Float64Array> {
    if (!this.client.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return new Float64Array(response.data[0]?.embedding ?? []);
  }
}
