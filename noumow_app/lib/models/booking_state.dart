/// In-progress parent booking context passed through the book flow.
class BookingState {
  const BookingState({
    required this.childId,
    required this.childName,
    this.therapist,
  });

  final String childId;
  final String childName;
  final Map<String, dynamic>? therapist;

  String get therapistId => (therapist?['therapist_id'] ?? '').toString();

  bool get hasTherapist => therapistId.isNotEmpty;

  BookingState copyWith({
    String? childId,
    String? childName,
    Map<String, dynamic>? therapist,
  }) {
    return BookingState(
      childId: childId ?? this.childId,
      childName: childName ?? this.childName,
      therapist: therapist ?? this.therapist,
    );
  }
}
