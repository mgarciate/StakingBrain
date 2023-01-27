import { ApiParams } from "@stakingbrain/common";

export class StandardApi {
  baseUrl: string;
  authToken?: string;
  keymanagerEndpoint?: string;

  constructor(apiParams: ApiParams) {
    this.authToken = apiParams.authToken;
    this.baseUrl = apiParams.baseUrl;
    this.keymanagerEndpoint = apiParams.apiPath;
  }

  protected async request(
    method: string,
    url: string,
    body?: any
  ): Promise<any> {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "",
      Host: "",
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? body : undefined,
    });
    if (response.ok) return await response.json();
    throw new Error(response.statusText);
  }

  protected async readText(files: File[]): Promise<string[]> {
    var data: string[] = [];
    for (var file of files) {
      const text = await file.text();
      data.push(text);
    }
    return data;
  }
}
