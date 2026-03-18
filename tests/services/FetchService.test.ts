import { requestUrl } from 'obsidian';
import { FetchService } from '../../src/services/FetchService';

describe('FetchService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (requestUrl as jest.Mock).mockResolvedValue({
            text: '<html></html>',
            arrayBuffer: new ArrayBuffer(8)
        });
    });

    it('should merge default headers with extra headers for html requests', async () => {
        const service = new FetchService();

        await service.fetchHtml('https://example.com', {
            Cookie: 'wants_mature_content=1;path=/'
        });

        expect(requestUrl).toHaveBeenCalledTimes(1);
        const call = (requestUrl as jest.Mock).mock.calls[0][0];

        expect(call.headers.Cookie).toBe('wants_mature_content=1;path=/');
        expect(call.headers['Accept-Language']).toBeDefined();
        expect(call.headers['User-Agent']).toBeDefined();
    });

    it('should merge default headers with extra headers for binary requests', async () => {
        const service = new FetchService();

        await service.fetchBinary('https://example.com/image.jpg', {
            Referer: 'https://example.com/'
        });

        expect(requestUrl).toHaveBeenCalledTimes(1);
        const call = (requestUrl as jest.Mock).mock.calls[0][0];

        expect(call.headers.Referer).toBe('https://example.com/');
        expect(call.headers['User-Agent']).toBeDefined();
    });
});
