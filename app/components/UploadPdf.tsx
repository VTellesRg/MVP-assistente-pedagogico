"use client";

import { useState } from "react";

export default function UploadPdf() {
	const [file, setFile] = useState<File | null>(null);

	async function upload() {
		if (!file) return;

		const formData = new FormData();

		formData.append("file", file);

		const response = await fetch(
			"/api/upload",
			{
				method: "POST",
				body: formData,
			}
		);

		const result = await response.json();

		console.log(result);
	}

	return (
		<div>
			<input
				type="file"
				accept=".pdf"
				onChange={(e) =>
					setFile(
						e.target.files?.[0] ?? null
					)
				}
			/>

			<button onClick={upload}>
				Upload
			</button>
		</div>
	);
}
