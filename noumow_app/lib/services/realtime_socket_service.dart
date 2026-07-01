import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../utils/therapists_api.dart';

/// Builds an authenticated Socket.io client for the Noumouw backend.
io.Socket createAuthenticatedSocket({
  required String jwtToken,
  String? appointmentsId,
  void Function(io.Socket socket)? onReady,
}) {
  final base = resolvedTherapistsApiBase();
  debugPrint('[socket] connecting to $base');

  final socket = io.io(
    base,
    io.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .enableAutoConnect()
        .enableReconnection()
        .setReconnectionAttempts(20)
        .setReconnectionDelay(2000)
        .setAuth({
          'token': jwtToken,
          if (appointmentsId != null && appointmentsId.isNotEmpty)
            'appointments_id': appointmentsId,
        })
        .build(),
  );

  socket.onConnect((_) {
    debugPrint('[socket] connected id=${socket.id}');
    onReady?.call(socket);
  });
  socket.onConnectError((err) {
    debugPrint('[socket] connect error: $err');
  });
  socket.onError((err) {
    debugPrint('[socket] error: $err');
  });
  socket.onDisconnect((reason) {
    debugPrint('[socket] disconnected: $reason');
  });

  return socket;
}
