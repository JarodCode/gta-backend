/**
 * API Service
 * 
 * This service handles external API interactions, particularly with the IGDB API.
 * It manages API authentication, rate limiting, and data transformation.
 */

import logger from "../utils/logger.ts";
import gameService from "./game-service.ts";
import { Game } from "./game-service.ts";

// IGDB API configuration
const IGDB_CLIENT_ID = Deno.env.get("IGDB_CLIENT_ID") || "";
const IGDB_CLIENT_SECRET = Deno.env.get("IGDB_CLIENT_SECRET") || "";
const IGDB_API_URL = "https://api.igdb.com/v4";
const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/token";

// Interface for IGDB Game
interface IGDBGame {
  id: number;
  name: string;
  cover?: {
    id: number;
    url: string;
  };
  first_release_date?: number;
  summary?: string;
}

/**
 * API Service class
 */
export class ApiService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  
  /**
   * Get an access token for the IGDB API
   * @returns Access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken;
    }
    
    // Check if we have client credentials
    if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
      throw new Error("IGDB API credentials not configured");
    }
    
    try {
      // Request a new token
      const response = await fetch(`${TWITCH_AUTH_URL}?client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_CLIENT_SECRET}&grant_type=client_credentials`, {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store the token and expiry
      this.accessToken = data.access_token;
      this.tokenExpiry = now + (data.expires_in * 1000);
      
      logger.debug("Obtained new IGDB API access token");
      
      return this.accessToken;
    } catch (error) {
      logger.error("Error getting IGDB access token", error);
      throw new Error(`Failed to authenticate with IGDB API: ${error.message}`);
    }
  }
  
  /**
   * Make a request to the IGDB API
   * @param endpoint - API endpoint
   * @param query - API query
   * @returns API response
   */
  private async makeIGDBRequest<T>(endpoint: string, query: string): Promise<T> {
    try {
      const token = await this.getAccessToken();
      
      const response = await fetch(`${IGDB_API_URL}/${endpoint}`, {
        method: "POST",
        headers: {
          "Client-ID": IGDB_CLIENT_ID,
          "Authorization": `Bearer ${token}`,
          "Content-Type": "text/plain",
        },
        body: query,
      });
      
      if (!response.ok) {
        throw new Error(`IGDB API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json() as T;
    } catch (error) {
      logger.error(`IGDB API request failed: ${error.message}`, { endpoint, query });
      throw new Error(`IGDB API request failed: ${error.message}`);
    }
  }
  
  /**
   * Search for games in the IGDB API
   * @param query - Search query
   * @param limit - Maximum number of results
   * @returns List of games
   */
  async searchGames(query: string, limit = 10): Promise<Game[]> {
    try {
      // Make API request
      const igdbQuery = `
        search "${query}";
        fields name, cover.url, first_release_date, summary;
        limit ${limit};
      `;
      
      const igdbGames = await this.makeIGDBRequest<IGDBGame[]>("games", igdbQuery);
      
      // Transform and store games
      const games: Game[] = [];
      
      for (const igdbGame of igdbGames) {
        // Transform cover URL
        let coverUrl = null;
        if (igdbGame.cover?.url) {
          // Convert from thumbnail to full size image
          coverUrl = igdbGame.cover.url.replace("t_thumb", "t_cover_big");
          
          // Ensure HTTPS
          if (coverUrl.startsWith("//")) {
            coverUrl = `https:${coverUrl}`;
          }
        }
        
        // Transform release date
        let releaseDate = null;
        if (igdbGame.first_release_date) {
          releaseDate = new Date(igdbGame.first_release_date * 1000).toISOString();
        }
        
        // Store in database
        const game = await gameService.createOrUpdateGame({
          external_id: `igdb:${igdbGame.id}`,
          title: igdbGame.name,
          cover_url: coverUrl,
          release_date: releaseDate,
          description: igdbGame.summary,
        });
        
        games.push(game);
      }
      
      return games;
    } catch (error) {
      logger.error(`Game search failed: ${error.message}`, { query });
      throw new Error(`Game search failed: ${error.message}`);
    }
  }
  
  /**
   * Get game details from the IGDB API
   * @param gameId - IGDB game ID
   * @returns Game details
   */
  async getGameDetails(gameId: number): Promise<Game> {
    try {
      // Check if we already have this game
      const existingGame = await gameService.getGameByExternalId(`igdb:${gameId}`);
      if (existingGame) {
        return existingGame;
      }
      
      // Make API request
      const igdbQuery = `
        fields name, cover.url, first_release_date, summary;
        where id = ${gameId};
      `;
      
      const igdbGames = await this.makeIGDBRequest<IGDBGame[]>("games", igdbQuery);
      
      if (igdbGames.length === 0) {
        throw new Error(`Game with ID ${gameId} not found`);
      }
      
      const igdbGame = igdbGames[0];
      
      // Transform cover URL
      let coverUrl = null;
      if (igdbGame.cover?.url) {
        // Convert from thumbnail to full size image
        coverUrl = igdbGame.cover.url.replace("t_thumb", "t_cover_big");
        
        // Ensure HTTPS
        if (coverUrl.startsWith("//")) {
          coverUrl = `https:${coverUrl}`;
        }
      }
      
      // Transform release date
      let releaseDate = null;
      if (igdbGame.first_release_date) {
        releaseDate = new Date(igdbGame.first_release_date * 1000).toISOString();
      }
      
      // Store in database
      return await gameService.createOrUpdateGame({
        external_id: `igdb:${igdbGame.id}`,
        title: igdbGame.name,
        cover_url: coverUrl,
        release_date: releaseDate,
        description: igdbGame.summary,
      });
    } catch (error) {
      logger.error(`Game details retrieval failed: ${error.message}`, { gameId });
      throw new Error(`Game details retrieval failed: ${error.message}`);
    }
  }
  
  /**
   * Get popular games from the IGDB API
   * @param limit - Maximum number of results
   * @returns List of popular games
   */
  async getPopularGames(limit = 10): Promise<Game[]> {
    try {
      // Make API request
      const igdbQuery = `
        fields name, cover.url, first_release_date, summary;
        sort popularity desc;
        limit ${limit};
      `;
      
      const igdbGames = await this.makeIGDBRequest<IGDBGame[]>("games", igdbQuery);
      
      // Transform and store games
      const games: Game[] = [];
      
      for (const igdbGame of igdbGames) {
        // Transform cover URL
        let coverUrl = null;
        if (igdbGame.cover?.url) {
          // Convert from thumbnail to full size image
          coverUrl = igdbGame.cover.url.replace("t_thumb", "t_cover_big");
          
          // Ensure HTTPS
          if (coverUrl.startsWith("//")) {
            coverUrl = `https:${coverUrl}`;
          }
        }
        
        // Transform release date
        let releaseDate = null;
        if (igdbGame.first_release_date) {
          releaseDate = new Date(igdbGame.first_release_date * 1000).toISOString();
        }
        
        // Store in database
        const game = await gameService.createOrUpdateGame({
          external_id: `igdb:${igdbGame.id}`,
          title: igdbGame.name,
          cover_url: coverUrl,
          release_date: releaseDate,
          description: igdbGame.summary,
        });
        
        games.push(game);
      }
      
      return games;
    } catch (error) {
      logger.error(`Popular games retrieval failed: ${error.message}`);
      throw new Error(`Popular games retrieval failed: ${error.message}`);
    }
  }
  
  /**
   * Get recent games from the IGDB API
   * @param limit - Maximum number of results
   * @returns List of recent games
   */
  async getRecentGames(limit = 10): Promise<Game[]> {
    try {
      // Calculate date 3 months ago
      const now = Math.floor(Date.now() / 1000);
      const threeMonthsAgo = now - (90 * 24 * 60 * 60);
      
      // Make API request
      const igdbQuery = `
        fields name, cover.url, first_release_date, summary;
        where first_release_date > ${threeMonthsAgo} & first_release_date < ${now};
        sort first_release_date desc;
        limit ${limit};
      `;
      
      const igdbGames = await this.makeIGDBRequest<IGDBGame[]>("games", igdbQuery);
      
      // Transform and store games
      const games: Game[] = [];
      
      for (const igdbGame of igdbGames) {
        // Transform cover URL
        let coverUrl = null;
        if (igdbGame.cover?.url) {
          // Convert from thumbnail to full size image
          coverUrl = igdbGame.cover.url.replace("t_thumb", "t_cover_big");
          
          // Ensure HTTPS
          if (coverUrl.startsWith("//")) {
            coverUrl = `https:${coverUrl}`;
          }
        }
        
        // Transform release date
        let releaseDate = null;
        if (igdbGame.first_release_date) {
          releaseDate = new Date(igdbGame.first_release_date * 1000).toISOString();
        }
        
        // Store in database
        const game = await gameService.createOrUpdateGame({
          external_id: `igdb:${igdbGame.id}`,
          title: igdbGame.name,
          cover_url: coverUrl,
          release_date: releaseDate,
          description: igdbGame.summary,
        });
        
        games.push(game);
      }
      
      return games;
    } catch (error) {
      logger.error(`Recent games retrieval failed: ${error.message}`);
      throw new Error(`Recent games retrieval failed: ${error.message}`);
    }
  }
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService; 