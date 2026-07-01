# Keep Supabase and Firebase SDK classes when R8 minifies release builds.
-keep class io.supabase.** { *; }
-keep class com.google.firebase.** { *; }

# Consider running a commercial obfuscator (e.g., DexGuard) before public launch for additional reverse-engineering resistance.

# Flutter wrapper
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
