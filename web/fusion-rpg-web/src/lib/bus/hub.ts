import * as signalR from "@microsoft/signalr";
import { apiBase } from "./rest";

let connection: signalR.HubConnection | null = null;

export function getHubConnection(): signalR.HubConnection {
  if (!connection) {
    const hubUrl = `${apiBase() || window.location.origin}/hub/rpg`;
    connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build();
  }
  return connection;
}
