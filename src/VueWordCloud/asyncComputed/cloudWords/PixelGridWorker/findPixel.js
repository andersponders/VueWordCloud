export default function([aspectWidth, aspectHeight], [startLeft, startTop], iteratee) {
	let stepLeft, stepTop;
	if (aspectWidth > aspectHeight) {
		stepLeft = 1;
		stepTop = aspectHeight / aspectWidth;
	} else
	if (aspectHeight > aspectWidth) {
		stepTop = 1;
		stepLeft = aspectWidth / aspectHeight;
	} else {
		stepLeft = stepTop = 1;
	}

	let value = [startLeft, startTop];
	if (iteratee(value)) {
		return value;
	}

	let endLeft = startLeft;
	let endTop = startTop;

	for (;;) {
		endLeft += stepLeft;
		endTop += stepTop;

		let currentEndLeft = Math.ceil(endLeft);
		let currentEndTop = Math.ceil(endTop);

		for (let top = 0; top < currentEndTop; ++top) {
			let value = [currentEndLeft, top];
			if (iteratee(value)) {
				return value;
			}
		}


		for (let left = 0; left < currentEndLeft; ++left) {
			let value = [left, currentEndTop];
			if (iteratee(value)) {
				return value;
			}
		}
	}
}
