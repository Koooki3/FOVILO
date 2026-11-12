"""Plot observed Watch startup and copy feedback from completed perf reports."""

import argparse
import json
import math
from pathlib import Path
from statistics import median

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator


VIDEOS = {
    "https://www.youtube.com/watch?v=aqz-KE-bpKQ": "Big Buck Bunny",
    "https://www.youtube.com/watch?v=eRsGyueVLvQ": "Sintel",
}
MODES = {"native": "Native", "off": "FOVILO off", "on": "FOVILO on"}
COLORS = ["#405974", "#746191", "#16776f"]


def read_report(path):
    report = json.loads(path.read_text(encoding="utf-8"))
    if report["complete"] is not True or report["scenario"] != "signed-out live Watch navigation":
        raise ValueError(f"{path}: expected a complete signed-out Watch run")
    startup = []
    for mode in MODES:
        samples = [sample for sample in report["samples"] if sample["mode"] == mode]
        if not samples or len(samples) != report["rounds"]:
            raise ValueError(f"{path}: invalid sample count for {mode}")
        startup.append([
            next(checkpoint["lcpMs"] for checkpoint in sample["checkpoints"]
                 if checkpoint["delayAfterDclMs"] == 3500)
            for sample in samples
        ])
    feedback = report["copyFeedback"]
    if len(feedback) != 12:
        raise ValueError(f"{path}: expected 12 copy trials")
    clicks = [[sample[key] for sample in feedback] for key in ("mutationMs", "nextFrameMs")]
    for values in startup + clicks:
        if any(value is None or not math.isfinite(value) or value < 0 for value in values):
            raise ValueError(f"{path}: invalid or missing timing")
    return report, startup, clicks


def draw_rows(axis, groups, labels, colors):
    rows = range(len(groups))
    for row, values, color in zip(rows, groups, colors, strict=True):
        # Spread adjacent samples vertically so equal timings remain visible.
        offsets = [0.32 * (index / max(len(values) - 1, 1) - 0.5) for index in range(len(values))]
        axis.scatter(sorted(values), [row + offset for offset in offsets],
                     color=color, s=23, alpha=0.78, linewidths=0, zorder=3)
        axis.plot([median(values)] * 2, [row - 0.27, row + 0.27],
                  color="#15283b", linewidth=1.6, zorder=4)
    axis.set_yticks(rows, labels)
    axis.set_ylim(len(groups) - 0.55, -0.55)
    axis.set_xlim(left=0)
    axis.xaxis.set_major_locator(MaxNLocator(5))
    axis.grid(axis="x", color="#dde5ec")
    axis.tick_params(length=0, pad=6)
    for spine in axis.spines.values():
        spine.set_visible(False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reports", nargs=2, type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    results = [read_report(path) for path in args.reports]
    names = [VIDEOS[report["url"]] for report, _, _ in results]
    if len(set(names)) != len(VIDEOS):
        raise ValueError("Expected reports for two different videos")

    report, _, _ = results[0]
    browser, = set(report["browsers"].values())
    version = browser.removeprefix("Chrome/")
    for other, _, _ in results[1:]:
        if any(other[key] != report[key] for key in ("host", "viewport", "build", "rounds", "browsers")):
            raise ValueError("The reports must use the same build, browser and benchmark setup")

    plt.rcParams.update({"font.size": 10, "text.color": "#15283b", "axes.labelcolor": "#15283b",
                        "xtick.color": "#34495e", "ytick.color": "#34495e"})
    figure, (startup, copies) = plt.subplots(1, 2, figsize=(12, 5.2), facecolor="#f6f8fb")
    figure.subplots_adjust(left=0.215, right=0.97, top=0.74, bottom=0.25, wspace=0.65)
    figure.text(0.045, 0.92, "FOVILO  |  Live Watch performance", size=22, weight="bold")
    width, height = (report["viewport"][key] for key in ("width", "height"))
    platform = {"win32": "Windows", "darwin": "macOS"}.get(report["host"]["platform"], report["host"]["platform"])
    figure.text(0.045, 0.858,
                f"Signed-out YouTube · headless Chromium {version} · {platform} · {width} × {height}",
                color="#405974")
    for axis in (startup, copies):
        axis.set_facecolor("#f6f8fb")
        axis.set_xlabel("Milliseconds", labelpad=10)
    startup.set_title("Startup LCP candidate", loc="left", weight="bold", pad=12)
    copies.set_title("Copy time link feedback", loc="left", weight="bold", pad=12)
    draw_rows(startup, [values for _, groups, _ in results for values in groups],
              [f"{name}  ·  {label}" for name in names for label in MODES.values()], COLORS * 2)
    draw_rows(copies, [values for _, _, groups in results for values in groups],
              [f"{name}  ·  {label}" for name in names for label in ("status", "frame 2")],
              [COLORS[0], COLORS[2]] * 2)
    figure.text(0.045, 0.119,
                f"Dots show observed trials. Lines mark medians. {report['rounds']} navigations per mode and video, "
                "12 clicks per video with clipboard access granted.", color="#405974", size=9)
    figure.text(0.045, 0.073,
                "Startup candidates sampled 3.5 s after DOMContentLoaded. Frame 2 approximates a paint opportunity.",
                color="#405974", size=9)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    figure.savefig(args.output, dpi=130)
    plt.close(figure)


if __name__ == "__main__":
    main()
