import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';

class PostLoginVideoPage extends StatefulWidget {
  const PostLoginVideoPage({super.key});

  @override
  State<PostLoginVideoPage> createState() => _PostLoginVideoPageState();
}

class _PostLoginVideoPageState extends State<PostLoginVideoPage> {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _showWhiteCover = true;
  bool _continuing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

    final c = VideoPlayerController.asset('assets/welcome.mp4')
      ..setLooping(false)
      ..addListener(_onTick);
    _controller = c;

    c.initialize().then((_) {
      if (!mounted) return;
      setState(() => _ready = true);
      c.play();
    }).catchError((Object e) {
      if (!mounted) return;
      setState(() => _error = userFacingErrorMessage(e));
    });
  }

  void _onTick() {
    final c = _controller;
    if (c == null) return;

    if (_showWhiteCover &&
        c.value.isPlaying &&
        c.value.position > const Duration(milliseconds: 50)) {
      setState(() => _showWhiteCover = false);
    }

    if (c.value.hasError && mounted) {
      setState(() {
        _error =
            c.value.errorDescription ?? 'post_login_video_playback_error'.tr();
      });
    }

    if (_ready &&
        !c.value.isPlaying &&
        c.value.position >= c.value.duration &&
        !_continuing &&
        mounted) {
      _continue();
    }
  }

  Future<void> _continue() async {
    if (_continuing) return;
    setState(() => _continuing = true);
    try {
      await _continueToHome();
    } finally {
      if (mounted) setState(() => _continuing = false);
    }
  }

  Future<void> _continueToHome() async {
    if (!mounted) return;
    Navigator.pushReplacementNamed(context, '/home');
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    _controller?.removeListener(_onTick);
    _controller?.dispose();
    super.dispose();
  }

  Widget _buildFullScreenVideo(VideoPlayerController c) {
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: c.value.size.width,
          height: c.value.size.height,
          child: VideoPlayer(c),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = _controller;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (_error != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, fontSize: 14),
                ),
              ),
            )
          else if (!_ready || c == null)
            const Center(
              child: CircularProgressIndicator(color: Colors.white),
            )
          else ...[
            _buildFullScreenVideo(c),
            if (_showWhiteCover) const ColoredBox(color: Colors.white),
          ],
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Padding(
              padding: EdgeInsets.only(
                top: MediaQuery.paddingOf(context).top + 12,
                left: 16,
                right: 16,
              ),
              child: Align(
                alignment: AlignmentDirectional.topEnd,
                child: Material(
                  color: Colors.transparent,
                  elevation: 4,
                  shadowColor: Colors.black54,
                  borderRadius: BorderRadius.circular(24),
                  child: InkWell(
                    onTap: _continuing ? null : _continue,
                    borderRadius: BorderRadius.circular(24),
                    child: Ink(
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.55),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: Colors.white.withOpacity(0.35)),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                      child: Text(
                        'post_login_video_skip'.tr(),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                          shadows: [
                            Shadow(
                              blurRadius: 4,
                              color: Colors.black54,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
