(function(factory) {
	if (typeof module !== 'undefined' && typeof exports !== 'undefined' && this === exports) {
		module.exports = factory(require('vue'));
	} else {
		this.Vue.component('VueWordCloud', factory(this.Vue));
	}
}).call(this, function(Vue) {

	let generateWordNodes = (function() {
		let fn = function() {
			let _toFont = function(fontFamily, fontSize, fontStyle, fontVariant, fontWeight, lineHeight) {
				return [fontStyle, fontVariant, fontWeight, `${fontSize}/${lineHeight}`, fontFamily].join(' ');
			};

			let _loadFont = async function(fontFamily, fontStyle, fontVariant, fontWeight) {
				try {
					await document.fonts.load(_toFont(fontFamily, '16px', fontStyle, fontVariant, fontWeight, 1),  'a');
				} catch (error) {}
			};

			let _convertTurnToRad = function(v) {
				return v * 2 * Math.PI;
			};

			(async function() {
				let canceled = false;

				let {words, containerSizeX, containerSizeY} = await new Promise(resolve => {
					let handler = function(event) {
						self.removeEventListener('message', handler);
						resolve(event.data);
					};
					self.addEventListener('message', handler);
				});

				console.log(words, containerSizeX, containerSizeY);

				self.addEventListener('message', function() {
					canceled = true;
				});

				words = words.filter(({weight}) => weight > 0);

				{
					let uniqueTexts = new Set();

					words = words.filter(({text}) => {
						if (uniqueTexts.has(text)) {
							return false;
						}
						uniqueTexts.add(text);
						return true;
					});
				}

				words.sort((word, otherWord) => otherWord.weight - word.weight);

				{
					let minWeight = Infinity;

					for (let word of words) {
						let {weight} = word;
						minWeight = Math.min(weight, minWeight);
					}

					let minFontSize = 2;

					for (let word of words) {
						let {weight} = word;
						let fontSize = weight / minWeight * minFontSize;
						Object.assign(word, {fontSize});
					}
				}

				for (let {fontFamily, fontStyle, fontVariant, fontWeight} of words) {
					await _loadFont(fontFamily, fontStyle, fontVariant, fontWeight);
				}

				{
					let out = [];

					let gridResolution = Math.pow(2, 22);
					let gridSizeX = Math.floor(Math.sqrt(containerSizeX / containerSizeY * gridResolution));
					let gridSizeY = Math.floor(gridResolution / gridSizeX);
					let gridData = Array(gridSizeX * gridSizeY).fill(false);

					for (let word of words) {
						let {text, color, rotation, fontFamily, fontSize, fontStyle, fontVariant, fontWeight} = word;
						let rotationRad = _convertTurnToRad(rotation);
						let font = _toFont(fontFamily, `${fontSize}px`, fontStyle, fontVariant, fontWeight, 1);

						let ctx = document.createElement('canvas').getContext('2d');

						ctx.font = font;
						let textSizeX = ctx.measureText(text).width;
						let textSizeY = fontSize;

						let sizeX = Math.ceil((textSizeX * Math.abs(Math.cos(rotationRad)) + textSizeY * Math.abs(Math.sin(rotationRad))));
						let sizeY = Math.ceil((textSizeX * Math.abs(Math.sin(rotationRad)) + textSizeY * Math.abs(Math.cos(rotationRad))));

						if (sizeX > 0 && sizeY > 0) {
							ctx.canvas.width = sizeX;
							ctx.canvas.height = sizeY;
							ctx.translate(sizeX / 2, sizeY / 2);
							ctx.rotate(rotationRad);
							ctx.font = font;
							ctx.textAlign = 'center';
							ctx.textBaseline = 'middle';
							ctx.fillText(text, 0, 0);
							let imageData = ctx.getImageData(0, 0, sizeX, sizeY).data;
							let occupiedPixels = [];
							for (let occupiedPixelX = sizeX; occupiedPixelX-- > 0;) {
								for (let occupiedPixelY = sizeY; occupiedPixelY-- > 0;) {
									if (imageData[(sizeX * occupiedPixelY + occupiedPixelX) * 4 + 3]) {
										occupiedPixels.push([occupiedPixelX, occupiedPixelY]);
									}
								}
							}

							for (let [positionX, positionY] of (function*(sizeX, sizeY) {
								let stepX, stepY;
								if (sizeX > sizeY) {
									stepX = 1;
									stepY = sizeY / sizeX;
								} else
								if (sizeY > sizeX) {
									stepY = 1;
									stepX = sizeX / sizeY;
								} else {
									stepX = stepY = 1;
								}
								let startX = Math.floor(sizeX / 2);
								let startY = Math.floor(sizeY / 2);
								let endX = startX - 1;
								let endY = startY - 1;
								let b = true;
								while (b) {
									b = false;
									if (endX < sizeX - 1) {
										endX++;
										for (let i = startY; i <= endY; i++) {
											yield [endX, i];
										}
										b = true;
									}
									if (endY < sizeY - 1) {
										//reverse
										endY++;
										for (let i = startX; i <= endX; i++) {
											yield [i, endY];
										}
										b = true;
									}
									if (startX > 0) {
										//reverse
										startX--;
										for (let i = startY; i <= endY; i++) {
											yield [startX, i];
										}
										b = true;
									}
									if (startY > 0) {
										startY--;
										for (let i = startX; i <= endX; i++) {
											yield [i, startY];
										}
										b = true;
									}
								}
							})(gridSizeX - sizeX, gridSizeY - sizeY)) {
								if ((() => {
									let occupiedGridPixels = [];
									for (let [occupiedPixelX, occupiedPixelY] of occupiedPixels) {
										let occupiedGridPixelX = positionX + occupiedPixelX;
										let occupiedGridPixelY = positionY + occupiedPixelY;
										if (occupiedGridPixelX >= 0 && occupiedGridPixelY >= 0 && occupiedGridPixelX < gridSizeX && occupiedGridPixelY < gridSizeY) {
											if (gridData[gridSizeX * occupiedGridPixelY + occupiedGridPixelX]) {
												return false;
											}
											occupiedGridPixels.push([occupiedGridPixelX, occupiedGridPixelY]);
										}
									}
									for (let [occupiedGridPixelX, occupiedGridPixelY] of occupiedGridPixels) {
										gridData[gridSizeX * occupiedGridPixelY + occupiedGridPixelX] = true;
									}
									return true;
								})()) {
									Object.assign(word, {positionX, positionY, sizeX, sizeY, textSizeX, textSizeY});
									out.push(word);
									break;
								}
							}
						}
					}

					words = out;
				}

				{
					let minOccupiedGridPixelX = Infinity;
					let minOccupiedGridPixelY = Infinity;
					let maxOccupiedGridPixelY = 0;
					let maxOccupiedGridPixelX = 0;

					for (let {positionX, positionY, sizeX, sizeY} of words) {
						minOccupiedGridPixelX = Math.min(positionX, minOccupiedGridPixelX);
						minOccupiedGridPixelY = Math.min(positionY, minOccupiedGridPixelY);
						maxOccupiedGridPixelX = Math.max(positionX + sizeX, maxOccupiedGridPixelX);
						maxOccupiedGridPixelY = Math.max(positionY + sizeY, maxOccupiedGridPixelY);
					}

					let scaleX = containerSizeX / (maxOccupiedGridPixelX - minOccupiedGridPixelX);
					let scaleY = containerSizeY / (maxOccupiedGridPixelY - minOccupiedGridPixelY);
					let scale = Math.min(scaleX, scaleY);

					for (let word of words) {
						word.positionX -= minOccupiedGridPixelX;
						word.positionY -= minOccupiedGridPixelY;
						word.positionX *= scale;
						word.positionY *= scale;
						word.sizeX *= scale;
						word.sizeY *= scale;
						word.textSizeX *= scale;
						word.textSizeY *= scale;
						word.fontSize *= scale;
					}
				}

				let wordNodes = words.map(({positionX, positionY, sizeX, sizeY, textSizeX, textSizeY, text, color, fontFamily, fontSize, fontStyle, fontVariant, fontWeight, rotation}) => ({
					text,
					style: {
						left: `${positionX + sizeX / 2 - textSizeX / 2}px`,
						top: `${positionY + sizeY / 2}px`,
						color,
						font: _toFont(fontFamily, `${fontSize}px`, fontStyle, fontVariant, fontWeight, 0),
						transform: `rotate(${rotation}turn)`,
					},
				}));

				self.postMessage();
			})();
		};

		let code = `(${fn.toString()})()`;
		let blob = new Blob([code]);
		let blobURL = URL.createObjectURL(blob);
		return blobURL;
	})();

	let _Worker$fromFunction = function(f) {
		let code = `(${f.toString()})()`;
		let blob = new Blob([code]);
		let blobURL = URL.createObjectURL(blob);
		return new Worker(blobURL);
	};

	let _delay = function(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	};





	return {
		render(createElement) {
			return(
				createElement('div', {
					style: {
						position: 'relative',
						width: '100%',
						height: '100%',
						overflow: 'hidden',
					},
				}, this.wordNodes.map(node =>
					createElement('div', {
						key: node.text,
						style: Object.assign({
							position: 'absolute',
							whiteSpace: 'nowrap',
							transition: 'all 1s',
						}, node.style),
					}, node.text)
				))
			);
		},

		props: {
			words: {
				type: Array,
				default() {
					return [];
				},
			},

			text: {
				type: [String, Function],
				default: '',
			},

			weight: {
				type: [Number, Function],
				default: 1,
			},

			color: {
				type: [String, Function],
				default: 'inherit',
			},

			rotation: {
				type: [String, Function],
				default() {
					let values = [0, 3/4];
					return function() {
						return values[Math.floor(Math.random() * values.length)];
					};
				},
			},

			fontFamily: {
				type: [String, Function],
				default: 'serif',
			},

			fontVariant: {
				type: [String, Function],
				default: 'normal',
			},

			fontStyle: {
				type: [String, Function],
				default: 'normal',
			},

			fontWeight: {
				type: [String, Function],
				default: 'normal',
			},
		},

		data() {
			return {
				elProps: {width: 0, height: 0},
				wordNodes: [],
			};
		},

		mounted() {
			this.updateElProps();
		},

		computed: {
			normalizedWords() {
				return this.words.map(word => {
					let text, weight, color, rotation, fontFamily, fontVariant, fontStyle, fontWeight;
					if (word) {
						switch (typeof word) {
							case 'string': {
								text = word;
								break;
							}
							case 'object': {
								if (Array.isArray(word)) {
									([text, weight, color, rotation, fontFamily, fontVariant, fontStyle, fontWeight] = word);
								} else {
									({text, weight, color, rotation, fontFamily, fontVariant, fontStyle, fontWeight} = word);
								}
								break;
							}
						}
					}
					if (text === undefined) {
						if (typeof this.text === 'function') {
							text = this.text(word);
						} else {
							text = this.text;
						}
					}
					if (weight === undefined) {
						if (typeof this.weight === 'function') {
							weight = this.weight(word);
						} else {
							weight = this.weight;
						}
					}
					if (color === undefined) {
						if (typeof this.color === 'function') {
							color = this.color(word);
						} else {
							color = this.color;
						}
					}
					if (rotation === undefined) {
						if (typeof this.rotation === 'function') {
							rotation = this.rotation(word);
						} else {
							rotation = this.rotation;
						}
					}
					if (fontFamily === undefined) {
						if (typeof this.fontFamily === 'function') {
							fontFamily = this.fontFamily(word);
						} else {
							fontFamily = this.fontFamily;
						}
					}
					if (fontVariant === undefined) {
						if (typeof this.fontVariant === 'function') {
							fontVariant = this.fontVariant(word);
						} else {
							fontVariant = this.fontVariant;
						}
					}
					if (fontStyle === undefined) {
						if (typeof this.fontStyle === 'function') {
							fontStyle = this.fontStyle(word);
						} else {
							fontStyle = this.fontStyle;
						}
					}
					if (fontWeight === undefined) {
						if (typeof this.fontWeight === 'function') {
							fontWeight = this.fontWeight(word);
						} else {
							fontWeight = this.fontWeight;
						}
					}
					return {text, weight, color, rotation, fontFamily, fontVariant, fontStyle, fontWeight};
				});
			},

			promisedWordNodes() {
				return this.promisifyWordNodes();
			},

			promisifyWordNodes() {
				let worker;
				return async function() {
					try {
						worker.postMessage(null);
					} catch (error) {}
					worker = new Worker(generateWordNodes);
					try {
						return await new Promise((resolve, reject) => {
							worker.addEventListener('message', function(event) {
								resolve(event.data);
							});
							worker.addEventListener('error', function(event) {
								reject(new Error(event));
							});
							let words = this.normalizedWords;
							let containerSizeX = this.elProps.width;
							let containerSizeY = this.elProps.height;
							worker.postMessage({words, containerSizeX, containerSizeY});
						});
					} finally {
						worker.terminate();
					}
				};
			},
		},

		watch: {
			promisedWordNodes: {
				async handler(promise) {
					try {
						this.wordNodes = await promise;
					} catch (error) {
						console.log(error);
					}
				},
				immediate: true,
			},
		},

		methods: {
			updateElProps() {
				if (this.$el) {
					let {width, height} = this.$el.getBoundingClientRect();
					this.elProps.width = width;
					this.elProps.height = height;
				}
				setTimeout(() => {
					this.updateElProps();
				}, 1000);
			},
		},
	};

});