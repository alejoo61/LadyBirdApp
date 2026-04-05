import 'package:dio/dio.dart';

class AuthApi {
  final Dio dio;
  AuthApi(this.dio);

  Future<Map<String, dynamic>> login({
    required String usuario,
    required String contrasena,
  }) async {
    final res = await dio.post('/api/auth/login', data: {
      'usuario': usuario,
      'contrasena': contrasena,
    });
    return (res.data as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> register({
    required String usuario,
    required String contrasena,
  }) async {
    final res = await dio.post('/api/auth/registro', data: {
      'usuario': usuario,
      'contrasena': contrasena,
    });
    return (res.data as Map).cast<String, dynamic>();
  }
}
