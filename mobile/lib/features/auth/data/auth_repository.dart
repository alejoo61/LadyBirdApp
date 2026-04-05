import 'dart:convert';
import '../../auth/domain/auth_user.dart';
import '../../../core/storage/secure_storage.dart';
import 'auth_api.dart';

class AuthRepository {
  final AuthApi api;
  final SecureStorage storage;

  AuthRepository({required this.api, required this.storage});

  Future<AuthUser> login(String usuario, String contrasena) async {
    final data = await api.login(usuario: usuario, contrasena: contrasena);
    final u = AuthUser.fromJson((data['usuario'] as Map).cast<String, dynamic>());
    await storage.saveUser(jsonEncode(u.toJson()));
    return u;
  }

  Future<AuthUser> register(String usuario, String contrasena) async {
    final data = await api.register(usuario: usuario, contrasena: contrasena);
    final u = AuthUser.fromJson((data['usuario'] as Map).cast<String, dynamic>());
    await storage.saveUser(jsonEncode(u.toJson()));
    return u;
  }

  Future<void> logout() => storage.clear();
}
