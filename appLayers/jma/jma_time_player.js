// jma_time_player.js

// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

class JmaTimePlayer {
	// プレースホルダーのIDを受け取れるように引数を追加
	constructor(
		selectId,
		containerId = "jma_time_player_container",
		intervalMs = 1000
	) {
		this.selectId = selectId;
		this.containerId = containerId;
		this.intervalMs = intervalMs;
		this.timer = null;
		this.isPlaying = false;

		window.addEventListener("DOMContentLoaded", () => {
			this.buildUI();
		});
	}

	buildUI() {
		const selectElm = document.getElementById(this.selectId);
		const containerElm = document.getElementById(this.containerId);

		if (!selectElm) return;

		// UIをまとめるコンテナ
		this.uiContainer = document.createElement("span");
		this.uiContainer.style.fontSize = "9pt";

		// 再生・停止ボタン
		this.playBtn = document.createElement("button");
		this.playBtn.innerText = "▶ 再生";
		this.playBtn.style.cursor = "pointer";
		this.playBtn.style.padding = "2px 6px";
		this.playBtn.style.fontSize = "0.85em";
		this.playBtn.style.verticalAlign = "middle";
		this.playBtn.onclick = () => this.togglePlay();

		// 再生速度の調整プルダウン
		this.speedSel = document.createElement("select");
		this.speedSel.style.marginLeft = "3px";
		this.speedSel.style.padding = "1px";
		this.speedSel.style.fontSize = "0.85em";
		this.speedSel.style.verticalAlign = "middle";

		const speeds = [
			{ label: "遅い", ms: 1600 },
			{ label: "普通", ms: 800 },
			{ label: "速い", ms: 400 },
		];

		speeds.forEach((s) => {
			let opt = document.createElement("option");
			opt.value = s.ms;
			opt.innerText = s.label;
			if (s.ms === this.intervalMs) opt.selected = true;
			this.speedSel.appendChild(opt);
		});

		this.speedSel.onchange = (e) => {
			this.intervalMs = Number(e.target.value);
			if (this.isPlaying) {
				this.stop();
				this.play();
			}
		};

		this.uiContainer.appendChild(this.playBtn);

		const speedLabel = document.createElement("span");
		speedLabel.innerText = " 速度:";
		speedLabel.style.marginLeft = "5px";
		speedLabel.style.fontSize = "0.85em";
		this.uiContainer.appendChild(speedLabel);

		this.uiContainer.appendChild(this.speedSel);

		// HTML側にプレースホルダーがあればそこに挿入、なければ（保険として）元の位置へ
		if (containerElm) {
			containerElm.appendChild(this.uiContainer);
		} else {
			selectElm.parentNode.insertBefore(
				this.uiContainer,
				selectElm.nextSibling
			);
		}
	}

	togglePlay() {
		if (this.isPlaying) {
			this.stop();
		} else {
			this.play();
		}
	}

	play() {
		const selectElm = document.getElementById(this.selectId);
		if (!selectElm || selectElm.options.length <= 1) return;

		this.isPlaying = true;
		this.playBtn.innerText = "■ 停止";

		if (selectElm.selectedIndex === 0) {
			selectElm.selectedIndex = selectElm.options.length - 1;
			selectElm.dispatchEvent(new Event("change"));
		}

		this.timer = setInterval(() => {
			if (!selectElm || selectElm.options.length === 0) return;

			let nextIndex = selectElm.selectedIndex - 1;

			if (nextIndex < 0) {
				nextIndex = selectElm.options.length - 1;
			}

			selectElm.selectedIndex = nextIndex;
			selectElm.dispatchEvent(new Event("change"));
		}, this.intervalMs);
	}

	stop() {
		this.isPlaying = false;
		if (this.playBtn) {
			this.playBtn.innerText = "▶ 再生";
		}
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
}

// 呼び出し時：プルダウンのID、プレースホルダーのID、初期速度(ms)
new JmaTimePlayer("timeSel", "jma_time_player_container", 800);
