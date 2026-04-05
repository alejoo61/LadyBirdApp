import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../core/networking/dio_client.dart';
import '../../../core/storage/secure_storage.dart';
import 'auth_api.dart';
import 'auth_repository.dart';

/// Para emulador Android: 10.0.2.2 apunta a tu PC (localhost)
final baseUrlProvider = Provider<String>((ref) => 'http://10.0.2.2:3001');

final dioProvider = Provider<Dio>((ref) {
  final baseUrl = ref.watch(baseUrlProvider);
  return createDio(baseUrl: baseUrl);
});

final secureStorageProvider = Provider<SecureStorage>((ref) => SecureStorage());

final authApiProvider = Provider<AuthApi>((ref) {
  final dio = ref.watch(dioProvider);
  return AuthApi(dio);
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    api: ref.watch(authApiProvider),
    storage: ref.watch(secureStorageProvider),
  );
});
