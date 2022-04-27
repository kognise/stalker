#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    // https://developer.apple.com/documentation/coregraphics/1408794-cgeventsourcecounterforeventtype
    pub fn CGEventSourceCounterForEventType(sourceState: u32, eventType: u32) -> u32;
}

pub fn last_input_tick() -> usize {
    unsafe { CGEventSourceCounterForEventType(0, !0) as usize }
}
