// app/api/file/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log(`[NextJS] File download request for ID: ${id}`);

    const response = await fetch(`${PYTHON_API_URL}/file/${id}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[NextJS] Python API error: ${error}`);
      return NextResponse.json(
        { error: 'Файл не знайдено' },
        { status: 404 }
      );
    }

    // Отримуємо ім'я файлу з заголовків
    const contentDisposition = response.headers.get('content-disposition');
    let filename = `video_${id}.mp4`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    console.log(`[NextJS] Sending file: ${filename}`);

    // Отримуємо бінарні дані
    const buffer = await response.arrayBuffer();
    
    // Повертаємо файл
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('[NextJS] Error downloading file:', error);
    return NextResponse.json(
      { error: 'Помилка завантаження файлу' },
      { status: 500 }
    );
  }
}