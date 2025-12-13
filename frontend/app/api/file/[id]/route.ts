// app/api/file/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import CONFIG from "@/lib/config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log(`[NextJS] File download request for ID: ${id}`);

    const response = await fetch(`${CONFIG.MAIN_SERVER}file/${id}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[NextJS] Python API error: ${error}`);
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Get the filename from headers
    const contentDisposition = response.headers.get('content-disposition');
    let filename = `video_${id}.mp4`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    console.log(`[NextJS] Sending file: ${filename}`);

    // Get binary data
    const buffer = await response.arrayBuffer();
    
    // Return the file
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
      { error: 'File download error' },
      { status: 500 }
    );
  }
}
