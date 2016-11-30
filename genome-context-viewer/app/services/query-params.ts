export class QueryParams {
  constructor(
    public numNeighbors: number,
    public sources: string[],  // Server IDs
    public matched?: number,
    public intermediate?: number
  ) { }

  toUrlSafe(): string {
    var params = {numNeighbors: this.numNeighbors};
    if (this.sources.length > 0)
      params.sources = this.sources;
    if (this.matched !== undefined)
      params.matched = this.matched;
    if (this.intermediate !== undefined)
      params.intermediate = this.intermediate;
    return params;
  }
}
