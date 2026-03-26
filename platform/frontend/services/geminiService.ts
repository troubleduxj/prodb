import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateSqlFromNaturalLanguage = async (prompt: string, schemaContext: string): Promise<string> => {
  if (!apiKey) {
    return "-- API Key not configured. Please check your environment settings.\n-- Mock: SELECT * FROM meters WHERE ts > NOW - 1h;";
  }

  try {
    const fullPrompt = `
      You are an expert TDengine SQL developer. Convert the following natural language request into a TDengine SQL query.
      
      Schema Context:
      ${schemaContext}

      Request: "${prompt}"

      Return ONLY the SQL query code. Do not wrap in markdown code blocks. Do not add explanations.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: fullPrompt,
    });

    return response.text?.trim() || "-- No response generated";
  } catch (error) {
    console.error("Gemini SQL Generation Error:", error);
    return `-- Error generating SQL: ${(error as Error).message}`;
  }
};

export const analyzeClusterHealth = async (nodeStatusJSON: string): Promise<string> => {
  if (!apiKey) return "Gemini API key missing. Cannot analyze cluster health.";

  try {
    const prompt = `
      Analyze the following TDengine cluster node status JSON. 
      Provide a concise 2-sentence summary of the cluster health, highlighting any nodes that need attention (e.g., high CPU, Offline, Syncing).
      
      Data:
      ${nodeStatusJSON}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "Analysis unavailable.";
  } catch (error) {
    console.error("Gemini Health Analysis Error:", error);
    return "Could not perform AI analysis at this time.";
  }
};

export const analyzeTagSchema = async (tableName: string, tagName: string, cardinality: number): Promise<string> => {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    const prompt = `
      You are a TDengine Database Architect. 
      Analyze this Tag Schema issue:
      - Table: ${tableName}
      - Tag Name: ${tagName}
      - Cardinality (Unique Values): ${cardinality}

      TDengine Rule: Tags are stored in RAM on the management node. High cardinality tags (>100k) can crash the node.
      
      Provide a 1-sentence actionable suggestion for the user. 
      Example outputs: 
      "Risk of OOM; change '${tagName}' from TAG to normal Column."
      "This looks like a timestamp; remove it from TAGs immediately."
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "Optimization recommended.";
  } catch (error) {
    console.error("AI Analysis Error", error);
    throw error; // Re-throw to trigger fallback
  }
};

export const analyzeDataQuality = async (tableName: string, stats: { outOfOrder: number, nullRate: number, duplication: number }): Promise<string> => {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    const prompt = `
      You are a Data Reliability Engineer for an IoT Platform using TDengine.
      Analyze the following data quality metrics for table '${tableName}':
      
      Metrics:
      - Out-of-Order Data: ${stats.outOfOrder}% (Critical if > 1%)
      - Null Rate: ${stats.nullRate}%
      - Duplication Rate: ${stats.duplication}%

      Context: 
      - Out-of-order data severely impacts TDengine write performance.
      - High null rates might indicate sensor failure.
      
      Provide a 1-sentence technical recommendation.
      Examples:
      "High out-of-order writes detected; verify NTP sync on gateways."
      "Data quality is healthy; no action required."
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "Check system logs.";
  } catch (error) {
    throw error;
  }
};

export const analyzeStorageTrend = async (historyData: any[], growthRate: string, daysRemaining: number): Promise<string> => {
  if (!apiKey) {
      throw new Error("API_KEY_MISSING");
  }

  try {
      // Simplify data to save tokens
      const simpleHistory = historyData.map((d, i) => i % 5 === 0 ? `${d.day}: ${d.usage}TB` : null).filter(Boolean).join(', ');
      
      const prompt = `
        You are a Storage Capacity Planner for a Database Cluster.
        
        Context:
        - Current Growth Rate: ${growthRate} GB/day
        - Estimated Disk Full In: ${daysRemaining} days
        - Sample Data Points (Last 30 days): [${simpleHistory}]
        
        Task:
        1. Analyze if the growth is linear or has spikes.
        2. Provide a strategic recommendation (e.g., expand storage, adjust retention policy, enable compression).
        3. Keep it under 2 sentences.
      `;

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
      });

      return response.text?.trim() || "Monitor storage usage closely.";
  } catch (error) {
      throw error;
  }
};

export const analyzeSlowQueryPattern = async (sqlPattern: string, avgDuration: number, executionCount: number): Promise<string> => {
  if (!apiKey) {
      throw new Error("API_KEY_MISSING");
  }

  try {
      const prompt = `
        You are a Database Performance Tuning Expert for TDengine.
        
        Analyze this Slow Query Pattern:
        - Pattern: "${sqlPattern}"
        - Avg Duration: ${avgDuration} ms
        - Execution Count: ${executionCount}
        
        Provide a specific optimization technique (e.g., adding an index, reducing scan range, using stream computing).
        Keep it to 1 sentence.
      `;

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
      });

      return response.text?.trim() || "Optimization suggested.";
  } catch (error) {
      throw error;
  }
};

export const explainQueryPlan = async (sql: string, planJson: any): Promise<string> => {
    if (!apiKey) {
        throw new Error("API_KEY_MISSING");
    }

    try {
        const prompt = `
          You are a TDengine Query Optimizer.
          
          SQL: "${sql}"
          
          Execution Plan (JSON):
          ${JSON.stringify(planJson)}
          
          Task:
          1. Identify the bottleneck (e.g., Full Table Scan on 'meters', Excessive Grouping).
          2. Suggest an optimization (e.g., "Add TAG index on device_id", "Reduce time range").
          3. Be concise (max 2 sentences).
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        return response.text?.trim() || "Analyze the plan for full table scans.";
    } catch (error) {
        throw error;
    }
};
