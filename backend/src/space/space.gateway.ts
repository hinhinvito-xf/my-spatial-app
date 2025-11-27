import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayDisconnect,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ 
  cors: true,
  maxHttpBufferSize: 50 * 1024 * 1024 
})
export class SpaceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, any>();
  
  private mapState = {
    backgroundImage: null as string | null,
    interactiveObjects: [] as any[]
  };

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.connectedUsers.delete(client.id);
    this.server.emit('user_left', client.id);
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, payload: { name: string; x: number; y: number; avatarConfig: any; isCameraOn: boolean }) {
    const newUser = {
      id: client.id,
      displayName: payload.name,
      x: payload.x,
      y: payload.y,
      avatarConfig: payload.avatarConfig || {},
      direction: 'down',
      isCameraOn: payload.isCameraOn || false
    };

    this.connectedUsers.set(client.id, newUser);
    client.broadcast.emit('user_joined', newUser);
    
    const everyoneElse = Array.from(this.connectedUsers.values());
    client.emit('existing_users', everyoneElse);
    client.emit('map_update', this.mapState);
  }

  @SubscribeMessage('move')
  handleMove(client: Socket, payload: { x: number; y: number; direction: string; isCameraOn: boolean }) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      user.x = payload.x;
      user.y = payload.y;
      user.direction = payload.direction;
      user.isCameraOn = payload.isCameraOn;
      this.connectedUsers.set(client.id, user);

      client.broadcast.emit('user_moved', { 
        id: client.id, 
        x: payload.x, 
        y: payload.y, 
        direction: payload.direction,
        isCameraOn: payload.isCameraOn 
      });
    }
  }

  @SubscribeMessage('signal')
  handleSignal(client: Socket, payload: { targetId: string; signal: any }) {
    this.server.to(payload.targetId).emit('signal', {
      senderId: client.id,
      signal: payload.signal,
    });
  }

  @SubscribeMessage('admin_upload_background')
  handleBackgroundUpload(client: Socket, payload: { image: string }) {
    console.log(`Admin uploaded background`);
    this.mapState.backgroundImage = payload.image;
    this.server.emit('map_update', this.mapState);
  }

  @SubscribeMessage('admin_clear_background')
  handleClearBackground(client: Socket) {
    console.log(`Admin cleared background`);
    this.mapState.backgroundImage = null;
    this.server.emit('map_update', this.mapState);
  }

  @SubscribeMessage('admin_add_object')
  handleAddObject(client: Socket, payload: any) {
    this.mapState.interactiveObjects.push(payload);
    this.server.emit('map_update', this.mapState);
  }

  // NEW: Handle Object Updates (Move/Resize)
  @SubscribeMessage('admin_update_object')
  handleUpdateObject(client: Socket, payload: any) {
    // payload: { id, x, y, width, height }
    this.mapState.interactiveObjects = this.mapState.interactiveObjects.map(obj => 
      obj.id === payload.id ? { ...obj, ...payload } : obj
    );
    this.server.emit('map_update', this.mapState);
  }

  @SubscribeMessage('admin_delete_object')
  handleDeleteObject(client: Socket, payload: { id: string }) {
    if (payload.id === 'ALL') {
      this.mapState.interactiveObjects = [];
    } else {
      this.mapState.interactiveObjects = this.mapState.interactiveObjects.filter(obj => obj.id !== payload.id);
    }
    this.server.emit('map_update', this.mapState);
  }
}