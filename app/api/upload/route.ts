import { writeFile } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";

export async function POST(req: Request) {
	try {
		const data = await req.formData();

		const file = data.get("file") as File;

		if (!file) {
			return Response.json(
				{ error: "Arquivo não enviado" },
				{ status: 400 }
			);
		}

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		const filename = `${uuid()}-${file.name}`;

		const path = join(
			process.cwd(),
			"uploads",
			filename
		);

		await writeFile(path, buffer);

		return Response.json({
			success: true,
			filename,
		});
	} catch (error) {
		console.error(error);

		return Response.json(
			{ error: "Erro no upload" },
			{ status: 500 }
		);
	}
}