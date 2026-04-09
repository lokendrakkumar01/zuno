const Interaction = require('../models/Interaction');

const DEFAULT_METRICS = {
      helpfulCount: 0,
      notUsefulCount: 0,
      viewCount: 0,
      viewedBy: [],
      saveCount: 0,
      shareCount: 0,
      commentCount: 0
};

const toPlainContent = (content) => {
      if (!content) return null;
      return typeof content.toObject === 'function' ? content.toObject() : { ...content };
};

const normalizeMetrics = (content) => ({
      ...content,
      metrics: {
            ...DEFAULT_METRICS,
            ...(content.metrics || {})
      }
});

const buildViewerState = (interactionTypes) => ({
      isHelpful: interactionTypes?.has('helpful') || false,
      isSaved: interactionTypes?.has('save') || false
});

const buildViewerInteractionMap = async (viewerId, contentIds) => {
      const uniqueIds = [...new Set(
            (contentIds || [])
                  .filter(Boolean)
                  .map((id) => id.toString())
      )];

      if (!viewerId || uniqueIds.length === 0) {
            return new Map();
      }

      const interactions = await Interaction.find({
            user: viewerId,
            content: { $in: uniqueIds },
            type: { $in: ['helpful', 'save'] }
      })
            .select('content type')
            .lean();

      return interactions.reduce((acc, interaction) => {
            const key = interaction.content.toString();
            const current = acc.get(key) || new Set();
            current.add(interaction.type);
            acc.set(key, current);
            return acc;
      }, new Map());
};

const decorateContentsForViewer = async (contents, viewerId) => {
      const plainContents = (contents || [])
            .filter(Boolean)
            .map((content) => normalizeMetrics(toPlainContent(content)));

      const interactionsByContent = await buildViewerInteractionMap(
            viewerId,
            plainContents.map((content) => content._id)
      );

      return plainContents.map((content) => ({
            ...content,
            viewerState: buildViewerState(interactionsByContent.get(content._id.toString()))
      }));
};

const decorateContentForViewer = async (content, viewerId) => {
      const [decorated] = await decorateContentsForViewer(content ? [content] : [], viewerId);
      return decorated || null;
};

module.exports = {
      DEFAULT_METRICS,
      normalizeMetrics,
      decorateContentsForViewer,
      decorateContentForViewer
};
