// Certificate pinning must be updated whenever the TLS certificate is renewed.

/// Production TLS certificate SHA-256 fingerprint for the API host.
class SecurityConfig {
  SecurityConfig._();

  // TODO: Replace with the production API TLS certificate SHA-256 fingerprint before launch.
  static const String productionApiCertSha256 =
      'SHA256:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF';
}
