class AuthUser {
  final int id;
  final String usuario;

  AuthUser({required this.id, required this.usuario});

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as int,
      usuario: json['usuario'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'id': id, 'usuario': usuario};
}
