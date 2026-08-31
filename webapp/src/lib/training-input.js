const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ALLOWED_AREAS = new Set(["A", "B", "Volledig"]);

function cleanText(value, maximumLength) {
	return String(value ?? "").trim().slice(0, maximumLength);
}

export function validateTrainingInput(body) {
	const dayOfWeek = Number(body?.dayOfWeek);
	const title = cleanText(body?.title, 160);
	const fieldName = cleanText(body?.fieldName, 80);
	const fieldArea = cleanText(body?.fieldArea || "Volledig", 20);
	const startTime = cleanText(body?.startTime, 5);
	const endTime = cleanText(body?.endTime, 5);
	const notes = cleanText(body?.notes, 500) || null;

	if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
		throw new Error("Kies een geldige dag");
	}
	if (!title) throw new Error("Vul een team of omschrijving in");
	if (!fieldName) throw new Error("Kies een veld");
	if (!ALLOWED_AREAS.has(fieldArea)) throw new Error("Kies een geldig velddeel");
	if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
		throw new Error("Vul geldige begin- en eindtijden in");
	}
	if (endTime <= startTime) throw new Error("De eindtijd moet na de begintijd liggen");

	return {
		dayOfWeek,
		title,
		fieldName,
		fieldArea,
		startTime,
		endTime,
		notes,
		active: body?.active !== false,
	};
}
