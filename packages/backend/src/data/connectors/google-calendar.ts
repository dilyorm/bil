import { BaseConnector } from './base';
import { DataSourceType, DataSourceCapabilities, CalendarEvent } from '../types';

interface GoogleCalendarCredentials {
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  clientSecret: string;
}

export class GoogleCalendarConnector extends BaseConnector {
  private credentials?: GoogleCalendarCredentials;
  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  constructor() {
    super('google-calendar', 'Google Calendar', DataSourceType.GOOGLE_CALENDAR);
  }

  async connect(credentials: GoogleCalendarCredentials): Promise<void> {
    try {
      this.credentials = credentials;
      
      // Test the connection by making a simple API call
      const isValid = await this.testConnection();
      if (!isValid) {
        throw new Error('Invalid Google Calendar credentials');
      }

      this.setConnected(true);
    } catch (error) {
      this.setConnected(false);
      throw new Error(`Failed to connect to Google Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    this.credentials = undefined as any;
    this.setConnected(false);
  }

  async testConnection(): Promise<boolean> {
    if (!this.credentials) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/users/me/calendarList`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Google Calendar connection test failed:', error);
      return false;
    }
  }

  getCapabilities(): DataSourceCapabilities {
    return {
      canRead: true,
      canWrite: true,
      canList: true,
      canSearch: true,
    };
  }

  async getEvents(calendarId: string = 'primary', timeMin?: Date, timeMax?: Date): Promise<CalendarEvent[]> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const params = new URLSearchParams();
    if (timeMin) params.append('timeMin', timeMin.toISOString());
    if (timeMax) params.append('timeMax', timeMax.toISOString());
    params.append('singleEvents', 'true');
    params.append('orderBy', 'startTime');

    const response = await fetch(`${this.baseUrl}/calendars/${calendarId}/events?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar events: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.items?.map((item: any) => ({
      id: item.id,
      title: item.summary || 'Untitled Event',
      description: item.description,
      startTime: new Date(item.start.dateTime || item.start.date),
      endTime: new Date(item.end.dateTime || item.end.date),
      location: item.location,
      attendees: item.attendees?.map((attendee: any) => attendee.email) || [],
      isAllDay: !item.start.dateTime,
    })) || [];
  }

  async createEvent(calendarId: string = 'primary', event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const eventData = {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.startTime?.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: event.endTime?.toISOString(),
        timeZone: 'UTC',
      },
      attendees: event.attendees?.map(email => ({ email })),
    };

    const response = await fetch(`${this.baseUrl}/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create calendar event: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      id: data.id,
      title: data.summary || 'Untitled Event',
      description: data.description,
      startTime: new Date(data.start.dateTime || data.start.date),
      endTime: new Date(data.end.dateTime || data.end.date),
      location: data.location,
      attendees: data.attendees?.map((attendee: any) => attendee.email) || [],
      isAllDay: !data.start.dateTime,
    };
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.credentials?.refreshToken || !this.credentials?.clientId || !this.credentials?.clientSecret) {
      throw new Error('Missing refresh token or client credentials');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: this.credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh access token: ${response.statusText}`);
    }

    const data = await response.json();
    this.credentials.accessToken = data.access_token;
  }
}